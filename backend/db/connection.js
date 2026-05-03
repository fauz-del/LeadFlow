const Datastore = require('nedb-promises');
const path = require('path');

const db = {
  leads:      Datastore.create({ filename: path.join(__dirname, '../../data/leads.db'), autoload: true }),
  jobs:       Datastore.create({ filename: path.join(__dirname, '../../data/jobs.db'), autoload: true }),
  activities: Datastore.create({ filename: path.join(__dirname, '../../data/activities.db'), autoload: true }),
  settings:   Datastore.create({ filename: path.join(__dirname, '../../data/settings.db'), autoload: true }),
  outreach:   Datastore.create({ filename: path.join(__dirname, '../../data/outreach.db'), autoload: true }), // <-- Added the comma here
  templates:  Datastore.create({ filename: path.join(__dirname, '../../data/templates.db'), autoload: true })
};

module.exports = db;

