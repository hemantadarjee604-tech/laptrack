const reports = require('../models/reportModel'), { wrap, csv } = require('../utils/helpers');
exports.show = wrap(async (req, res) => {
  const r = await reports.run(req.params.type);
  if (!r) return res.status(404).render('error', { title: 'Not found', code: 404, message: 'Unknown report.' });
  if (req.query.format === 'csv') {
    res.set({ 'Content-Type': 'text/csv', 'Content-Disposition': `attachment; filename="${r.type}-report.csv"` });
    return res.send(csv(r.cols, r.rows));
  }
  res.render('admin/report', { title: r.title, r, types: reports.types });
});
