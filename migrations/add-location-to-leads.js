'use strict';

module.exports = {
  up: async (queryInterface, Sequelize) => {
    await queryInterface.addColumn('leads', 'location', {
      type: Sequelize.STRING,
      allowNull: true,
      after: 'notes'
    });
  },

  down: async (queryInterface) => {
    await queryInterface.removeColumn('leads', 'location');
  }
};
