'use strict';
require('dotenv').config();
const postgresServer = require('./server-postgres');
if (require.main === module) postgresServer.start();
module.exports = postgresServer;
