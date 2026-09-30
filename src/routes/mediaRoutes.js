const express = require('express');
const { servirMedia } = require('../utils/mediaAccess');

const router = express.Router();

router.get('/:token', servirMedia);

module.exports = router;
