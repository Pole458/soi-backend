'use strict';

const { repo } = require('./repo');
const { sha256 } = require('crypto-hash');
const multer = require('multer');
const upload = multer();

/**
 * Max age for a token (1 day).
 */
const tokenMaxAge = 24 * 3600 * 1000;

/**
 * Generates a new token for the user.
 * @param {string} id 
 * @param {string} password 
 */
async function generateToken(id, password) {

	const now = Date.now();

	// Generate hash
	const hash = await sha256("" + id + password + now);

	return {
		id: id,
		time: now,
		hash: hash,
	};
}

/**
 * Check if the token is valid.
 * @param {object} token should be a json object containing { id, time, hash }
 */
function checkToken(token) {

	// Check token integrity
	if (!token || !token.id || !token.time || !token.hash) {
		return false;
	}

	// Check token expiration date
	if (token.time + tokenMaxAge < Date.now()) {
		return false;
	}

	// Check token hash
	const user = repo.getUser(token.id);
	if (!user || user.token_hash !== token.hash) {
		return false;
	}

	return true;
}

/**
 * Helper method to set the token cookie in a response.
 */
function setTokenCookie(resp, token) {
	resp.cookie("token", token, {
		signed: false,
		secure: false,
		expires: new Date(token.time + tokenMaxAge)
	});
}

function validateUsername(str) {
	// Check if input is a valid string
	if (!str || typeof str !== 'string') {
		return false;
	}

	// Check length
	if (str.length <= 0 || str.length > 20) {
		return false;
	}

	// Check with regex if name contains only allowed characters
	if (!(/^[0-9a-zA-Z]+$/.test(str))) {
		return false;
	}

	return true;
}

function validatePassword(str) {
	// Check if input is a valid string
	if (!str || typeof str !== 'string') {
		return false;
	}

	// Check length
	if (str.length <= 0 || str.length > 20) {
		return false;
	}

	// Check with regex if name contains only allowed characters
	if (!(/^[0-9a-zA-Z]+$/.test(str))) {
		return false;
	}

	return true;
}

/**
 * Middleware used by route to check authorization before actually using the api
 * @param {*} req 
 * @param {*} res 
 * @param {*} next 
 */
const checkAuth = function (req, resp, next) {

	const token = req.cookies.token;

	if (!(checkToken(token))) {
		// resp.status(401);
		// resp.clearCookie("token");
		// resp.json({ error: "Token is not valid" })

		next();
		return;
	}

	resp.locals.id = token.id;

	next();
};

function routes(app) {

	/**
	 * API that can be used to sign in as a new user and then login.
	 * It requires valid username and password.
	 * It also renews the token.
	 */
	app.post('/signin', async (req, resp) => {

		const { username, password } = req.body;

		// Validate username
		if (!validateUsername(username) || !validatePassword(password)) {
			resp.status(400);
			resp.json({ error: "Please provide valid username and password" });
			return;
		}

		// Check if user is already registered
		if (repo.isUserNameTaken(username)) {
			resp.status(400);
			resp.json({ error: "Username is already registered" });
			return;
		}

		// Register new user
		const user_id = repo.insertUser(username, password).id;

		// Generate new token
		const token = await generateToken(user_id, password);

		// Update stored token
		repo.updateToken(token);

		// Register event
		repo.insertEvent(user_id, "signed in")

		resp.status(200);
		setTokenCookie(resp, token);
		resp.end();
	});

	/**
	 * API that can be used to login given valid username and password.
	 * It also renews the token.
	 */
	app.post('/login', async (req, resp) => {

		// Check for submitted username and password
		const { username, password } = req.body;

		// Validate username and password
		if (!validateUsername(username) || !validatePassword(password)) {
			resp.status(400);
			resp.json({ error: "Please provide valid username and password" });
			return;
		}

		// Check if user is registered
		if (!repo.isUserNameTaken(username)) {
			resp.status(400);
			resp.json({ error: "Username is not registered" });
			return;
		}

		// Get stored password for username
		const user = repo.getUserByUsername(username);

		// If passwords don't match, the sumbitted password is wrong
		if (user.password !== password) {
			resp.status(401);
			resp.json({ error: "Password is wrong" });
			return;
		}

		// Generate new token
		const token = await generateToken(user.id, password);

		// Update stored token
		repo.updateToken(token);

		resp.status(200);
		setTokenCookie(resp, token);
		resp.end();
	});

	/**
	 * API call that can be used to login given a valid token.
	 * It also renews the token. 
	 */
	app.post('/login-with-token', async (req, resp) => {

		// Check if user has a valid token
		var token = req.cookies.token;

		if (!(checkToken(token))) {
			resp.status(401);
			resp.clearCookie("token");
			resp.json({ error: "Token is not valid" })
			return;
		}

		// Renew token
		token = await generateToken(token.id, repo.getUser(token.id).password);
		// Update token in database
		repo.updateToken(token);

		resp.status(200);
		setTokenCookie(resp, token);
		resp.end();
	});

	/**
	 * Returns all users.
	 */
	app.get('/users', checkAuth, (req, resp) => {

		const polished_users = []

		repo.getUsers().forEach(user => {
			{
				polished_users.push({
					id: user.id,
					username: user.username
				})
			}
		})

		resp.status(200);
		resp.json(polished_users);
	});

	app.get("/user/:id", checkAuth, (req, resp) => {
		const id = parseInt(req.params.id);

		const user = repo.getUser(id);

		if (user) {
			resp.status(200);
			resp.json({
				id: user.id,
				username: user.username,
			});
		} else {
			resp.status(404);
			resp.json({ error: "No user found with id " + id })
		}
	});

	/**
	 * Returns all the events made by an user given its id.
	 */
	app.get("/user/:id/events", checkAuth, (req, resp) => {
		const id = parseInt(req.params.id);

		resp.status(200);
		resp.json(repo.getEventsFromUserId(id));
	});

	/**
	 * Returns all projects.
	 */
	app.get("/projects", checkAuth, (req, resp) => {
		resp.status(200);
		resp.json(repo.getProjects());
	});

	/**
	 * Returns a project given its id.
	 */
	app.get("/project/:id", checkAuth, (req, resp) => {

		const id = parseInt(req.params.id);

		const project = repo.getProject(id);

		if (project) {
			resp.status(200);
			resp.json(project);
		} else {
			resp.status(404);
			resp.json({ error: "No project found with id " + id })
		}
	});

	/**
	 * Returns all the records of a project given its id.
	 */
	app.get("/project/:id/records", checkAuth, (req, resp) => {

		const id = parseInt(req.params.id);

		resp.status(200);
		resp.json(repo.getProjectRecords(id));
	});

	/**
	 * Returns all the events regarding a project given its id.
	 */
	app.get("/project/:id/events", checkAuth, (req, resp) => {

		const id = parseInt(req.params.id);

		resp.status(200);
		resp.json(repo.getEventsFromProjectId(id));
	});

	/**
	 * Returns a record given its id.
	 */
	app.get("/record/:id", checkAuth, (req, resp) => {
		const id = parseInt(req.params.id);

		const record = repo.getRecord(id);

		if (record) {
			resp.status(200);
			resp.json(record);
		} else {
			resp.status(404);
			resp.json({ error: "No record found with id " + id })
		}
	});

	/**
	 * Returns all the events regarding a record given its id.
	 */
	app.get("/record/:id/events", checkAuth, (req, resp) => {

		const id = parseInt(req.params.id);

		resp.status(200);
		resp.json(repo.getEventsFromRecordId(id));
	});

	app.post("/project", checkAuth, (req, resp) => {

		const { title, recordType } = req.body;

		// Check if a project with the same title already exists
		if (repo.isProjectTitleTaken(title)) {
			resp.status(400);
			resp.json({ error: "A project with this title already exists" })
			return;
		}

		if (recordType !== "Text" && recordType !== "Image") {
			resp.status(400);
			resp.json({ error: "Record type can only be Text or Image" })
			return;
		}

		const project = repo.insertProject(title, recordType);

		repo.insertEvent(resp.locals.id, "created project", {
			project_id: project.id,
			project_title: project.title
		})

		resp.status(200);
		resp.json(project);
	})

	app.post("/project/:id/record", [checkAuth, upload.single("Image")], (req, resp) => {

		const project_id = parseInt(req.params.id);

		if (isNaN(project_id)) {
			resp.status(400);
			resp.json({ error: "Please provide a valid project id" })
			return;
		}

		const project = repo.getProject(project_id);

		if (!project) {
			resp.status(400);
			resp.json({ error: "Please provide a valid project id" })
			return;
		}

		let input;
		if (project.recordType === "Image") {
			input = req.file;
		} else {
			input = req.body.Text;
		}

		const record = repo.insertRecord(project, input);

		repo.insertEvent(resp.locals.id, "added record to project", {
			project_id: project.id,
			record_id: record.id,
			input: input
		})

		resp.status(200);
		resp.json(record);
	})

	app.post("/remove-project", checkAuth, (req, resp) => {

		const project_id = parseInt(req.body.project_id);

		repo.removeProject(project_id);

		repo.insertEvent(resp.locals.id, "deleted project", {
			project_id: project_id,
		})

		resp.status(200);
		resp.end();
	})

	app.post("/remove-record", checkAuth, (req, resp) => {

		const record_id = parseInt(req.body.record_id);

		const record = repo.getRecord(record_id)

		if (record) {
			repo.insertEvent(resp.locals.id, "deleted record", {
				record_id: record_id,
				project_id: record.project_id
			})

			repo.removeRecord(record_id);
		}

		resp.status(200);
		resp.end();
	})

	app.post("/tag-project", checkAuth, (req, resp) => {

		const { tag_name } = req.body;
		const project_id = parseInt(req.body.project_id)

		repo.addTagToProject(project_id, tag_name);

		repo.insertEvent(resp.locals.id, "added tag to project", {
			project_id: project_id,
			tag_name: tag_name
		})

		resp.status(200);
		resp.end();
	})

	app.post("/project-tag-value", checkAuth, (req, resp) => {

		const { tag_name, tag_value } = req.body;
		const project_id = parseInt(req.body.project_id)

		repo.addTagValueToProject(project_id, tag_name, tag_value);

		repo.insertEvent(resp.locals.id, "added value to project", {
			project_id: project_id,
			tag_name: tag_name,
			tag_value: tag_value
		})

		resp.status(200);
		resp.end();
	})

	app.post("/project-remove-tag", checkAuth, (req, resp) => {

		const { tag_name } = req.body;
		const project_id = parseInt(req.body.project_id);

		repo.removeTagFromProject(project_id, tag_name);

		repo.insertEvent(resp.locals.id, "removed tag from project", {
			project_id: project_id,
			tag_name: tag_name
		})

		resp.status(200);
		resp.end();
	})

	app.post("/project-remove-tag-value", checkAuth, (req, resp) => {

		const { tag_name, tag_value } = req.body;
		const project_id = parseInt(req.body.project_id);

		repo.removeTagValueFromProject(project_id, tag_name, tag_value);

		repo.insertEvent(resp.locals.id, "removed tag value from project", {
			project_id: project_id,
			tag_name: tag_name,
			tag_value: tag_value
		})

		resp.status(200);
		resp.end();
	})

	app.post("/tag-record", checkAuth, (req, resp) => {

		const { tag_name, tag_value } = req.body;
		const record_id = parseInt(req.body.record_id)

		repo.setTagToRecord(record_id, tag_name, tag_value);

		repo.insertEvent(resp.locals.id, "set tag to record", {
			record_id: record_id,
			tag_name: tag_name,
			tag_value: tag_value
		})

		resp.status(200);
		resp.end();
	})

	app.post("/remove-record-tag", checkAuth, (req, resp) => {

		const { tag_name } = req.body;
		const record_id = parseInt(req.body.record_id);

		repo.removeTagFromRecord(record_id, tag_name);

		repo.insertEvent(resp.locals.id, "removed tag from record", {
			record_id: record_id,
			tag_name: tag_name
		})

		resp.status(200);
		resp.end();
	})

	app.post("/record/:id/update", [checkAuth, upload.single("Image")], (req, resp) => {

		const record_id = parseInt(req.params.id);

		const record = repo.getRecord(record_id);

		if (!record) {
			resp.status(400);
			resp.json({ error: "Please provide a valid record id" })
			return;
		}

		const project = repo.getProject(record.project_id);

		if (!project) {
			resp.status(500);
			resp.json({ error: "Record has not associated project" })
			return;
		}

		let input;
		if (project.recordType === "Image") {
			input = req.file;
		} else {
			input = req.body.Text;
		}

		repo.updateInputRecord(record_id, input, project.recordType);

		repo.insertEvent(resp.locals.id, "modified input of record", {
			record_id: record_id
		})

		resp.status(200);
		resp.json(repo.getRecord(record_id));
	})

	app.get("/events", checkAuth, (req, resp) => {
		resp.status(200);
		resp.json(repo.getEvents());
	})

	app.get("/images/:filename/", (req, resp) => {

		const filename = req.params.filename;

		const path = repo.getImagePath(filename);

		resp.sendFile(path, { root: __dirname + "/../" });
	})
}

module.exports = { routes };
