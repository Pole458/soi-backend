'use strict'

const knex = require('knex')({
	client: 'sqlite3',
	connection: {
		filename: "./soi-backend-db.sqlite"
	},
	useNullAsDefault: true,
	asyncStackTraces: true // only for debug
});

const db = {};

db.init = async () => {
	if(!(await knex.schema.hasTable("user"))) {
		await knex.schema.createTable('user', table => {
			table.string('username').primary();
			table.string('password');
			table.time('token_time');
			table.string('token_hash');
		}).asCallback(()=>{});
	}

	console.debug("DB ready");
}


db.isUserRegistered = async (username) => {
	const q = await knex('user').where({username: username});
	return q.length > 0;
}

// May return undefined if the username is not registered
db.getUserPassword = async (username) => {
	const q = (await knex.from('user').select('password').where({username: username}))[0];
	if(q) return q.password;
	return undefined;
}

db.updateToken = async (token) => {
	await knex('user')
	.where({username: token.username})
	.update({
		token_hash: token.hash,
		token_time: token.time
	});
}

// May return undefined if the username is not registered
db.getTokenHash = async (username) => {
	const q = await knex.from('user').select('token_hash').where({username: username});
	console.debug(q);
	if(q) return q.token_hash;
	return undefined;
}

db.registerUser = async (username, password, token) => {
	await knex('user').insert({
		username: username,
		password: password,
		token_hash: token.hash,
		token_time: token.time
	})
}


db.getUsers = async () => {
	return await knex.from('user'); //.select('username');
}

db.init();

module.exports = { db };