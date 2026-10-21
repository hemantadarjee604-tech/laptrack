const reports = require('../models/reportModel'), { wrap } = require('../utils/helpers');
exports.index = wrap(async (req, res) => res.render('admin/dashboard', { title: 'Dashboard', ...(await reports.dashboard()) }));
