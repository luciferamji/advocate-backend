const {  Task } = require('../models');
const { Op } = require('sequelize');

// Remove adminId from response
const cleanTask = (taskInstance) => {
  const task = taskInstance.get({ plain: true });
  delete task.adminId;
  return task;
};

exports.getTasks = async (req, res) => {
  try {
    const { startDate, endDate } = req.query;
    const adminId = req.user.id;

    const whereClause = { adminId };

    if (startDate && endDate) {
      whereClause.start = {
        [Op.between]: [new Date(startDate), new Date(endDate)],
      };
    }

    const tasks = await Task.findAll({
      where: whereClause,
      order: [['start', 'ASC']],
    });

    const cleanTasks = tasks.map(cleanTask);

    res.status(200).json({
      success: true,
      data: {
        count: cleanTasks.length,
        data: cleanTasks,
      },
    });
  } catch (error) {
    console.error('Error fetching tasks:', error);
    res.status(500).json({ success: false, message: 'Internal server error' });
  }
};

exports.getTaskById = async (req, res) => {
  try {
    const task = await Task.findOne({
      where: { id: req.params.id, adminId: req.user.id }
    });

    if (!task) return res.status(404).json({ success: false, message: 'Task not found' });

    res.status(200).json({
      success: true,
      data: {
        count: 1,
        data: [cleanTask(task)],
      },
    });
  } catch (error) {
    console.error('Error fetching task:', error);
    res.status(500).json({ success: false, message: 'Internal server error' });
  }
};

exports.createTask = async (req, res) => {
  try {
    const newTask = await Task.create({ ...req.body, adminId: req.user.id });

    res.status(201).json({
      success: true,
      data: {
        count: 1,
        data: [cleanTask(newTask)],
      },
    });
  } catch (error) {
    console.error('Error creating task:', error);
    res.status(400).json({ success: false, message: 'Failed to create task' });
  }
};

exports.updateTask = async (req, res) => {
  try {
    const task = await Task.findOne({
      where: { id: req.params.id, adminId: req.user.id }
    });

    if (!task) return res.status(404).json({ success: false, message: 'Task not found' });

    await task.update(req.body);

    res.status(200).json({
      success: true,
      data: {
        count: 1,
        data: [cleanTask(task)],
      },
    });
  } catch (error) {
    console.error('Error updating task:', error);
    res.status(400).json({ success: false, message: 'Failed to update task' });
  }
};

exports.deleteTask = async (req, res) => {
  try {
    const task = await Task.findOne({
      where: { id: req.params.id, adminId: req.user.id }
    });

    if (!task) return res.status(404).json({ success: false, message: 'Task not found' });

    await task.destroy();

    res.status(200).json({
      success: true,
      data: {
        count: 1,
        data: [],
      },
    });
  } catch (error) {
    console.error('Error deleting task:', error);
    res.status(500).json({ success: false, message: 'Internal server error' });
  }
};
