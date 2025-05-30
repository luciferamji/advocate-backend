module.exports = (sequelize, DataTypes) => {
  const HearingCommentDoc = sequelize.define('hearing_comment_doc', {
    id: {
      type: DataTypes.INTEGER,
      primaryKey: true,
      autoIncrement: true
    },
    hearingCommentId: {
      type: DataTypes.INTEGER,
      allowNull: false,
      references: {
        model: 'hearing_comment',
        key: 'id'
      }
    },
    filePath: {
      type: DataTypes.STRING,
      allowNull: false
    },
    fileName: {
      type: DataTypes.STRING,
      allowNull: false
    },
    fileType: {
      type: DataTypes.STRING,
      allowNull: true
    },
    fileSize: {
      type: DataTypes.INTEGER,
      allowNull: true
    }
  }, {
    timestamps: true,
    tableName: 'hearing_comment_doc'
  });
  
  return HearingCommentDoc;
};