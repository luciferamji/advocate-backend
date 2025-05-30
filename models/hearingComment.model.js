module.exports = (sequelize, DataTypes) => {
  const HearingComment = sequelize.define('hearing_comment', {
    id: {
      type: DataTypes.INTEGER,
      primaryKey: true,
      autoIncrement: true
    },
    hearingId: {
      type: DataTypes.INTEGER,
      allowNull: false,
      references: {
        model: 'hearing',
        key: 'id'
      }
    },
    text: {
      type: DataTypes.TEXT,
      allowNull: false
    },
    createdBy: {
      type: DataTypes.INTEGER,
      allowNull: false,
      references: {
        model: 'admin',
        key: 'id'
      }
    }
  }, {
    timestamps: true,
    tableName: 'hearing_comment'
  });
  
  return HearingComment;
};