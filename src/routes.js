'use strict';

const { db } = require('./db');
const {sha256} = require('crypto-hash');

const tokenMaxAge = 24 * 3600 * 1000; // 1 day

async function generateToken(username, password) {
	const now = Date.now();
	const hash = await sha256(username + password + now);
	return {
		username: username,
		time: now,
		hash: hash,
	};
}

async function checkToken(token) {
	// Check token integrity
	if(!token || !token.username || !token.time || !token.hash) {
		return false;
	}

	// Check token expiration date (1 day)
	if(token.time + tokenMaxAge < Date.now()) {
		return false;
	}

	// Check token hash
	const storedTokenHash = await db.getTokenHash(token.username);
	if(storedTokenHash != token.hash) {
		return false;
	}

	return true;
}

function setTokenCookie(resp, token) {
	resp.cookie("token", token, {
		signed: false,
		secure: false,
		expires: new Date(token.time + tokenMaxAge)
	});
}

function validateUsername(str) {
	// Check if input is a valid string
	if(!str || typeof str !== 'string') {
		return false;
	}

	// Check length
	if(str.length <= 0 || str.length > 20) {
		return false;
	}

	// Check with regex if name contains only allowed characters
	if(!(/^[0-9a-zA-Z]+$/.test(str))) {
		return false;
	}
	
	return true;
}

function validatePassword(str) {
	// Check if input is a valid string
	if(!str || typeof str !== 'string') {
		return false;
	}

	// Check length
	if(str.length <= 0 || str.length > 20) {
		return false;
	}

	// Check with regex if name contains only allowed characters
	if(!(/^[0-9a-zA-Z]+$/.test(str))) {
		return false;
	}

	return true;
}

// function isNonBlank(str) {
// 	return typeof str === 'string' && str.trim();
// }

// function isInteger(n) {
// 	if (typeof n === 'number') {
// 		return true;
// 	}
// 	if (typeof n === 'string') {
// 		try {
// 			parseInt(n, 10);
// 			return true;
// 		} catch (_) {
// 			return false;
// 		}
// 	}
// 	return false;
// }

function routes(app) {

	app.post('/signin', async (req, resp) => {
		
		const { username, password } = req.body;

		// Validate username
		if(!validateUsername(username) || !validatePassword(password)) {
			resp.status(400);
			resp.json({error: "Please provide valid username and password"});
			return;
		}

		// Check if user is already registered
		if(await db.isUserRegistered(username)) {
			resp.status(400);
			resp.json({error: "Username is already registered"});
			return;
		}

		// Generate new token
		const token = await generateToken(username, password);

		// Register new user (with token)
		await db.registerUser(username, password, token);

		resp.status(200);
		setTokenCookie(resp, token);
		resp.end();
	});

	app.post('/login', async (req, resp) => {

		// Check for submitted username and password
		const { username, password } = req.body;

		// Validate username and password
		if(!validateUsername(username) || !validatePassword(password)) {
			resp.status(400);
			resp.json({error: "Please provide valid username and password"});
			return;
		}

		// Check if user is registered
		if(!(await db.isUserRegistered(username))) {
			resp.status(400);
			resp.json({error: "Username is not registered"});
			return;
		}

		// Get stored password for username
		const storedPassword = await db.getUserPassword(username);

		// If passwords don't match, the sumbitted password is wrong
		if(storedPassword != password) {
			resp.status(401);
			resp.json({error: "Password is wrong"});
			return;
		}

		// Generate new token
		const token = await generateToken(username, password);

		// Update token in database
		await db.updateToken(token)
	
		resp.status(200);
		setTokenCookie(resp, token);
		resp.end();
	});

	app.post('/check-token', async (req, resp) => {

		// Check if user has a valid token
		var token = req.cookies.token;
		if(!(await checkToken(token))) {
			resp.status(401);
			resp.clearCookie("token");
			resp.json({error: "Token is not valid"})
			return;
		}

		resp.status(200);

		const { renew } = req.body;
		if(renew) {
			// Renew token

			token = await generateToken(token.username, await db.getUserPassword(token.username));

			// Update token in database
			await db.updateToken(token)

			setTokenCookie(resp, token);
		}
		resp.end();
	});


	app.get('/users', async (req, resp) => {

		const token = req.cookies.token;

		if(await checkToken(token)) {
			resp.status(200);
			resp.json({users: await db.getUsers()});
		} else {
			resp.status(401);
			resp.clearCookie("token");
			resp.json({users: await db.getUsers(), error: "Token is not valid"});
		}
	});
}

module.exports = { routes };
