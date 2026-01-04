// functions/firebaseAdmin.js
const admin = require('firebase-admin')

let app

function getAdmin() {
  if (app) {
    return admin
  }

  admin.initializeApp()
  app = admin.app()

  return admin
}

module.exports = { getAdmin }
