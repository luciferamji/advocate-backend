module.exports = (sequelize, DataTypes) => {
  const CaseCommentDoc = sequelize.define('case_comment_doc', {
    id: {
      type: DataTypes.UUID,
      primaryKey: true,
      defaultValue: DataTypes.UUIDV4,
    },
    caseCommentId: {
      type: DataTypes.UUID,
      allowNull: false,
      references: {
        model: 'case_comment',
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
    tableName: 'case_comment_doc'
  });
  
  return CaseCommentDoc;
};