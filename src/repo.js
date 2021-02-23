'use strict'

const knex = require('knex')({
	client: 'sqlite3',
	connection: {
		filename: "./soi-backend-db.sqlite"
	},
	useNullAsDefault: true,
	asyncStackTraces: true // only for debug
});

/**
 * JSON object containing Repository helper methods.
 */
const repo = {};

repo.init = async () => {

	// Create table User (if not exists)
	if(!(await knex.schema.hasTable("user"))) {
		await knex.schema.createTable('user', table => {
			table.string('username').primary();
			table.string('password');
			table.time('token_time');
			table.string('token_hash');
		}).asCallback(()=>{});
	};

	// Create table Project (if not exists)
	if(!(await knex.schema.hasTable("project"))) {
		await knex.schema.createTable("project", table => {
			table.string("title").primary();
		}).asCallback(()=>{});
	};

	// Create table Dataset (if not exists)
	if(!(await knex.schema.hasTable("dataset"))) {
		await knex.schema.createTable("dataset", table => {
			table.increments("id").primary();
		}).asCallback(()=>{});
	};

	// Create table Record (if not exists)
	if(!(await knex.schema.hasTable("record"))) {
		await knex.schema.createTable("record", table => {
			table.string("input")
		}).asCallback(()=>{});
	};


	console.debug("DB ready");
}


repo.isUserRegistered = async (username) => {
	const q = await knex('user').where({username: username});
	return q.length > 0;
}

// May return undefined if the username is not registered
repo.getUserPassword = async (username) => {
	const q = (await knex.from('user').select('password').where({username: username}))[0];
	if(q) return q.password;
	return undefined;
}

repo.updateToken = async (token) => {
	await knex('user')
	.where({username: token.username})
	.update({
		token_hash: token.hash,
		token_time: token.time
	});
}

// May return undefined if the username is not registered
repo.getTokenHash = async (username) => {
	const q = await knex.from('user').select('token_hash').where({username: username});
	if(q && q[0]) return q[0].token_hash;
	return undefined;
}

repo.registerUser = async (username, password, token) => {
	await knex('user').insert({
		username: username,
		password: password,
		token_hash: token.hash,
		token_time: token.time
	})
}

repo.getUsers = async () => {
	return await knex.from('user'); //.select('username');
}

repo.getProjects = async () => {
	return [
		{title: "Project 1"},
		{title: "Project 2"},
		{title: "Project 3"},
		{title: "Project 4"}
	]
}

repo.getProject = async (title) => {
	return {
		title: title,
		info: "info about " + title
	};
}

repo.init();

module.exports = { repo };