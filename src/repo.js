'use strict'

const fs = require("fs")
const mkdirp = require('mkdirp');
const getDirName = require('path').dirname;
const path = require('path')
const mime = require('mime-types');

const testing = false;

const loki = require('lokijs');


// Changes $loki to id and removes lokijs metadata
const polish = (i) => {

	if (!i) return null;

	const o = {}
	for (const [key, value] of Object.entries(i)) {
		if (key === "$loki")
			o["id"] = value
		else if (key !== "meta")
			o[key] = value
	}

	return o;
}

const imagePath = "images"

function writeFileSyncRecursive(filename, content) {
	// -- normalize path separator to '/' instead of path.sep, 
	// -- as / works in node for Windows as well, and mixed \\ and / can appear in the path
	let filepath = filename.replace(/\\/g, '/');

	// -- preparation to allow absolute paths as well
	let root = '';
	if (filepath[0] === '/') {
		root = '/';
		filepath = filepath.slice(1);
	}
	else if (filepath[1] === ':') {
		root = filepath.slice(0, 3);   // c:\
		filepath = filepath.slice(3);
	}

	// -- create folders all the way down
	const folders = filepath.split('/').slice(0, -1);  // remove last item, file
	folders.reduce(
		(acc, folder) => {
			const folderPath = acc + folder + '/';
			if (!fs.existsSync(folderPath)) {
				fs.mkdirSync(folderPath);
			}
			return folderPath
		},
		root // first 'acc', important
	);

	// -- write file
	fs.writeFileSync(root + filepath, content);
}

const deleteFile = (fileName) => {
	try {
		fs.unlinkSync(fileName);
	} catch (err) { }
}

const db = new loki(testing ? "test.json" : "db.json", {
	autoload: !testing,
	autoloadCallback: () => {

		db.users = db.getCollection("users");
		if (!db.users)
			db.users = db.addCollection("users", {
				unique: ['username'],
				indices: ["username"]
			});

		db.projects = db.getCollection("projects");
		if (!db.projects)
			db.projects = db.addCollection("projects", {
				unique: ["title"],
				indices: ["title"]
			});

		db.records = db.getCollection("records");
		if (!db.records)
			db.records = db.addCollection("records", {
				indices: ["project_id"]
			});

		db.eventsCollection = db.getCollection("events")
		if (!db.eventsCollection)
			db.eventsCollection = db.addCollection("events");

		repo.init();
	},
	autosave: !testing,
	autosaveInterval: 4000
});

/**
 * JSON object containing Repository helper methods.
 */
const repo = {};

repo.init = () => {

	if (testing)
		repo.fillForTesting();

	console.debug("DB ready");
}

repo.fillForTesting = () => {

	const project = repo.insertProject("Pokemon", "Text");

	const project2 = repo.insertProject("Giochi", "Text");
	//repo.removeProject(title2);

	repo.addTagToProject(project.id, "Type");
	repo.addTagValueToProject(project.id, "Type", "Grass");
	repo.addTagValueToProject(project.id, "Type", "Water");
	repo.addTagValueToProject(project.id, "Type", "Fire");

	repo.addTagToProject(project.id, "Region");
	repo.addTagValueToProject(project.id, "Region", "Kanto");


	repo.insertRecord(project, "Bulbasaur");
	repo.insertRecord(project, "Charmander");
	const recordId = repo.insertRecord(project, "Squirtle").id;

	repo.setTagToRecord(recordId, "Region", "Kanto");
	repo.setTagToRecord(recordId, "Type", "Water");

	//repo.removeTagFromProject(project_id, "Region");
	//repo.removeTagValueFromProject(project_id, "Type", "Water")
	//repo.removeTagFromRecord(record_id, "Type")
	repo.updateInputRecord(recordId, "Blastoise")
}

repo.isUserNameTaken = (username) => {
	const q = db.users.findOne({ username: username });
	return q ? true : false;
}

repo.getUserByUsername = (username) => {
	return polish(db.users.findOne({ username: username }));
}

repo.updateToken = (token) => {
	db.users.chain().find({
		$loki: token.id
	}).update(user => {
		user.token_hash = token.hash;
		user.token_time = token.time;
	});
}

repo.insertUser = (username, password) => {
	return polish(db.users.insert({
		username: username,
		password: password,
	}));
}

repo.getUser = (id) => {
	return polish(db.users.get(id));
}

repo.getUsers = () => {
	return db.users.chain().map(user => {
		return {
			id: user.$loki,
			username: user.username
		}
	}).data({ removeMeta: true });
}

repo.getEvents = () => {
	return db.eventsCollection.chain().map(e => {
		return {
			id: e.$loki,
			user_id: e.user_id,
			date: e.meta.created,
			action: e.action,
			info: e.info
		}
	}).data({ removeMeta: true })
}

repo.insertProject = (title, recordType) => {
	return polish(db.projects.insert({
		title: title,
		recordType: recordType,
		tags: [],
	}));
}

repo.removeProject = (id) => {
	db.projects.chain().find({
		$loki: id
	}).remove();
}

repo.getProject = (id) => {

	const project = db.projects.get(id);

	if (project) {
		return {
			id: project.$loki,
			title: project.title,
			recordType: project.recordType,
			tags: project.tags
		}
	}

	return null;
}

repo.getProjectFromTitle = (title) => {
	return db.projects.chain().findOne({
		title: title
	}).map(project => {
		return {
			id: project.$loki,
			title: project.title,
			tags: project.tags
		}
	}).data({ removeMeta: true });
}

repo.isProjectTitleTaken = (title) => {
	const q = db.projects.findOne({ title: title })
	return q ? true : false;
}

repo.getProjects = () => {
	return db.projects.chain().map(project => {
		return {
			id: project.$loki,
			title: project.title
		}
	}).data({ removeMeta: true });
}


repo.addTagToProject = (project_id, tag_name) => {
	db.projects.chain().find({
		$loki: project_id,
	}).update(project => {
		if (!(project.tags.some(tag => tag.name === tag_name))) {
			project.tags.push({
				name: tag_name,
				values: []
			})
		}
	});
}

repo.removeTagFromProject = (project_id, tag_name) => {
	db.projects.chain().find({
		$loki: project_id,
	}).update(project => {
		for (const tag of project.tags) {
			if (tag.name === tag_name) {
				var index = project.tags.indexOf(tag)
				project.tags.splice(index, 1)
			}
		}
	})

	db.records.chain().find({
		project_id: project_id
	}).update(record => {
		for (const tag of record.tags) {
			if (tag.name === tag_name) {
				var index = record.tags.indexOf(tag)
				record.tags.splice(index, 1)
			}
		}
	})

}

repo.addTagValueToProject = (project_id, tag_name, tag_value) => {
	db.projects.chain().find({
		$loki: project_id,
	}).update(project => {
		for (const tag of project.tags) {
			let b = true;
			if (tag.name === tag_name) {
				for (const value of tag.values) {
					if (value === tag_value)
						b = false;
				}

				if (b)
					tag.values.push(tag_value);

				break;
			}
		}
	});
}

repo.removeTagValueFromProject = (project_id, tag_name, tag_value) => {
	db.projects.chain().find({
		$loki: project_id,
	}).update(project => {
		for (const tag of project.tags) {
			if (tag.name === tag_name) {
				for (const value of tag.values) {
					if (value === tag_value) {
						var index = tag.values.indexOf(value)
						tag.values.splice(index, 1)
					}
				}
			}
		}
	})

	db.records.chain().find({
		project_id: project_id
	}).update(record => {
		for (const tag of record.tags) {
			if (tag.name === tag_name && tag.value === tag_value) {
				var index = record.tags.indexOf(tag)
				record.tags.splice(index, 1)
			}
		}
	})
}

repo.insertRecord = (project, input) => {

	if (project.recordType === "Image") {

		// Insert empty record to get id
		const record_id = db.records.insert({
			project_id: project.id,
			input: null,
			tags: []
		}).$loki;

		const fileName = "img_" + record_id + "." + mime.extension(input.mimetype);

		// Create file from input
		writeFileSyncRecursive(repo.getImagePath(fileName), input.buffer);

		// Update record to match filename
		repo.updateInputRecord(record_id, fileName);

		// Return inserted record
		return repo.getRecord(record_id);

	} else {
		return polish(db.records.insert({
			project_id: project.id,
			input: input,
			tags: []
		}));
	}
}

repo.removeRecord = (record_id) => {
	db.records.chain().find({
		$loki: record_id,
	}).remove();
}

repo.updateInputRecord = (record_id, input, recordType) => {

	if (recordType === "Image") {

		const oldFileName = repo.getRecord(record_id).input;

		const fileName = "img_" + record_id + "." + mime.extension(input.mimetype);

		if (fileName !== oldFileName) {

			// Delete old file in filesystem
			deleteFile(repo.getImagePath(oldFileName));

			// Update stored filename in db
			db.records.chain().find({
				$loki: record_id,
			}, true).update(record => {
				record.input = fileName;
			})
		}

		// Update stored file in filesystem
		writeFileSyncRecursive(repo.getImagePath(fileName), input.buffer);

	} else {
		// Update stored value in db
		db.records.chain().find({
			$loki: record_id,
		}, true).update(record => {
			record.input = input;
		})
	}
}

repo.getRecord = (id) => {
	const record = db.records.get(id);

	if (record) {
		return {
			id: record.$loki,
			project_id: record.project_id,
			input: record.input,
			tags: record.tags
		}
	}

	return null;
}

repo.getProjectRecords = (project_id) => {
	return db.records.chain().find({
		project_id: project_id
	}).map(record => {
		return {
			id: record.$loki,
			input: record.input,
			project_id: record.project_id,
			tags: record.tags
		}
	}).data({ removeMeta: true });
}

repo.setTagToRecord = (record_id, tag_name, tag_value) => {
	db.records.chain().find({
		$loki: record_id,
	}, true).update(record => {
		let b = false;
		for (const tag of record.tags) {
			if (tag.name === tag_name) {
				tag.value = tag_value;
				b = true;
				break;
			}
		}

		if (!b) {
			record.tags.push({
				name: tag_name,
				value: tag_value
			})
		}
	});
}

repo.removeTagFromRecord = (record_id, tag_name) => {
	db.records.chain().find({
		$loki: record_id
	}).update(record => {
		for (const tag of record.tags) {
			if (tag.name === tag_name) {
				var index = record.tags.indexOf(tag)
				record.tags.splice(index, 1)
			}
		}
	})
}

repo.insertEvent = (user_id, action, info) => {
	return polish(db.eventsCollection.insert({
		user_id: user_id,
		action: action,
		info: info,
	}));
}

repo.getEventsFromUserId = (user_id) => {
	return db.eventsCollection.chain().find({
		user_id: user_id
	}).map(e => {
		const e2 = polish(e)
		e2.date = e.meta.created
		return e2
	}).data({ removeMeta: true });
}

repo.getEventsFromProjectId = (project_id) => {
	return db.eventsCollection.chain().find({
		"info.project_id": project_id
	}).map(e => {
		const e2 = polish(e)
		e2.date = e.meta.created
		return e2
	}).data({ removeMeta: true });
}

repo.getEventsFromRecordId = (record_id) => {
	return db.eventsCollection.chain().find({
		"info.record_id": record_id
	}).map(e => {
		const e2 = polish(e)
		e2.date = e.meta.created
		return e2
	}).data({ removeMeta: true });
}

repo.getImagePath = (fileName) => {
	return imagePath + "/" + fileName;
}

module.exports = { repo };