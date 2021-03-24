'use strict'

const testing = true;

const loki = require('lokijs');

const db = new loki("test.json");

/**
 * JSON object containing Repository helper methods.
 */
const repo = {};

repo.init = () => {

	db.users = db.addCollection("users", {
		unique: ['username'],
		indices: ["username"]
	});

	db.projects = db.addCollection("projects", {
		unique: ["title"],
		indices: ["title"]
	});

	db.records = db.addCollection("records", {
		indices: ["project_id"]
	});

	if (testing) {
		repo.fillForTesting();
	}

	console.debug("DB ready");
}

repo.fillForTesting = () => {

	const project_id = repo.insertProject("Pokemon").$loki;

	//const title2 = repo.insertProject("Giochi").title;
	//repo.removeProject(title2);

	repo.addTagToProject(project_id, "Type");
	repo.addTagValueToProject(project_id, "Type", "Grass");
	repo.addTagValueToProject(project_id, "Type", "Water");
	repo.addTagValueToProject(project_id, "Type", "Fire");

	repo.addTagToProject(project_id, "Region");
	repo.addTagValueToProject(project_id, "Region", "Kanto");


	repo.insertRecord(project_id, "Bulbasaur");
	repo.insertRecord(project_id, "Charmander");
	const record_id = repo.insertRecord(project_id, "Squirtle").$loki;

	repo.setTagToRecord(record_id, "Region", "Kanto");
	repo.setTagToRecord(record_id, "Type", "Water");

	//repo.removeTagFromProject(project_id, "Region");
	//repo.removeTagValueFromProject(project_id, "Type", "Water")
	//repo.removeTagFromRecord(record_id, "Type")
	repo.modifyInputRecord(record_id, "Blastoise")

}

repo.isUserRegistered = (username) => {
	const q = db.users.findOne({ username: username });
	return q ? true : false;
}

// May return undefined if the username is not registered
repo.getUserPassword = (username) => {
	const q = db.users.findOne({ username: username });
	return q ? q.password : undefined;
}

repo.updateToken = (token) => {
	db.users.chain().find({
		username: token.username
	}).update(user => {
		user.token_hash = token.hash;
		user.token_time = token.time;
	});
}

// Returns undefined if the username is not registered
repo.getTokenHash = (username) => {
	const q = db.users.findOne({ username: username });
	return q ? q.token_hash : undefined;
}

repo.insertUser = (username, password, token) => {
	db.users.insert({
		username: username,
		password: password,
		token_hash: token.hash,
		token_time: token.time
	});
}

repo.getUser = (id) => {

	const user = db.users.get(id);

	if (user) {
		return {
			id: user.$loki,
			username: user.username,
		};
	}

	return null;
}

repo.getUsers = () => {
	return db.users.chain().map(user => {
		return {
			id: user.$loki,
			username: user.username
		}
	}).data({ removeMeta: true });
}


repo.insertProject = (title) => {
	return db.projects.insert({
		title: title,
		tags: [],
	});
}

repo.removeProject = (title) => {
	db.projects.chain().find({
		title: title
	}).remove();
}


repo.getProject = (id) => {

	const project = db.projects.get(id);

	if (project) {
		return {
			id: project.$loki,
			title: project.title,
			tags: project.tags
		}
	}

	return null;
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
		for (const tag of record.tags){
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
			if (tag.name === tag_name) {
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
				for(const value of tag.values){
					if(value === tag_value){
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
		for (const tag of record.tags){
			if (tag.name === tag_name && tag.value === tag_value) {
				var index = record.tags.indexOf(tag)
				record.tags.splice(index, 1)
			}
		}
	})
}


repo.insertRecord = (project_id, input) => {
	return db.records.insert({
		project_id: project_id,
		input: input,
		tags: []
	});
}

repo.removeRecord = (record_id) => {
	db.records.chain().find({
		$loki: record_id,
	}).remove();
}


repo.modifyInputRecord = (record_id, input) => {
	db.records.chain().find({
		$loki: record_id,
	}, true).update(record => {
			record.input = input;
		})
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
		for (const tag of record.tags){
			if (tag.name === tag_name) {
				var index = record.tags.indexOf(tag)
				record.tags.splice(index, 1)
			}
		}
	})
}


repo.init();

module.exports = { repo };