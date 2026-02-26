const express = require('express');
const { auth, authorize } = require('../middleware/auth');
const taskController = require('../controllers/taskController');

const router = express.Router();

router.use(auth);

// Agent specific routes
router.get('/my-tasks', authorize(4), taskController.getAgentTasks);
router.patch('/:id/status', authorize(4, 2, 3), taskController.updateTaskStatus);

// Admin/Owner routes
router.post('/', authorize(2, 3), taskController.createTask);
router.get('/', authorize(2, 3), taskController.getTenantTasks);
router.delete('/:id', authorize(2, 3), taskController.deleteTask);

module.exports = router;
