const express = require('express');
const { 
  getClients, 
  getClient, 
  createClient, 
  updateClient, 
  deleteClient,
  searchClients,
  assignClientToAdvocate
} = require('../controllers/client.controller');
const { protect, checkOwnership } = require('../middleware/auth.middleware');
const { Client } = require('../models');

const router = express.Router();

// Apply middleware to all routes
router.use(protect);

router.get('/search', searchClients);
router.put('/:clientId/reassign', checkOwnership(Client, 'clientId'), assignClientToAdvocate);

router.route('/')
  .get(getClients)
  .post(createClient);



router.route('/:id')
  .get(checkOwnership(Client, 'id'), getClient)
  .put(checkOwnership(Client, 'id'), updateClient)
  .delete(checkOwnership(Client, 'id'), deleteClient);


module.exports = router;