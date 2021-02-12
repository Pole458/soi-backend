'use strict';

const { db } = require('./db');
const {sha256} = require('crypto-hash');

async function generateToken(username, password) {
	const now = Date.now();
	const hash = await sha256(username + password + now);
	return {
		username: username,
		time: now,
		hash: hash,
	};
}

function isNonBlank(str) {
	return typeof str === 'string' && str.trim();
}

function isInteger(n) {
	if (typeof n === 'number') {
		return true;
	}
	if (typeof n === 'string') {
		try {
			parseInt(n, 10);
			return true;
		} catch (_) {
			return false;
		}
	}
	return false;
}

function routes(app) {

	app.post('/signin', async (req, resp) => {
		
		const { username, password } = req.body;

		// Check if user is already registered
		if(await db.isUserRegistered(username)) {
			resp.status(400);
			resp.json({error: "Username is already registered"});
			return;
		}

		// Generate token
		const token = await generateToken(username, password);

		// Register user
		await db.registerUser(username, password, token);

		resp.json({token: token});
		resp.status(200);
	});

	app.post('/login', async (req, resp) => {

		const { username, password } = req.body;

		// Check if user is registered
		if(!(await db.isUserRegistered(username))) {
			resp.status(400);
			resp.json({error: "Username is not registered"});
			return;
		}

		// Get password for username
		const storedPassword = await db.getUserPassword(username);

		// If passwords don't match, the sumbitted password is wrong
		if(storedPassword != password) {
			console.debug(storedPassword + ' ' + password)
			resp.status(401);
			resp.json({error: "Password is wrong"});
			return;
		}

		// Generate token
		const token = await generateToken(username, password);

		// Update token in database
		await db.updateToken(token)
	
		resp.status(200);
		resp.json({token: token})
	});

	app.get('/users', async (req, resp) => {

		// const { token } = req.body;

		// // Check token integrity
		// if(!token || !token.username || !token.time || !token.hash) {
		// 	resp.status(400);
		// 	resp.json({error: "Token is not valid"})
		// 	return;
		// }

		// // Check token expiration date (1 day)
		// if(token.time + 24*3600*1000 < Date.now()) {
		// 	resp.status(401);
		// 	resp.json({error: "Token is expired"})
		// 	return;
		// }

		// // Check token hash
		// const storedTokenHash = await db.getTokenHash(token.username);

		// if(storedTokenHash != token.hash) {
		// 	resp.status(401);
		// 	resp.json({error: "Token is not valid"})
		// 	return;
		// }

		resp.status(200);
		resp.json({users: await db.getUsers()});
	})
}

module.exports = { routes };
