// The Cloud Functions for Firebase SDK to create Cloud Functions and setup triggers.
const functions = require('firebase-functions');

// The Firebase Admin SDK to access Firestore.
const admin = require('firebase-admin');
admin.initializeApp();

//Server function that awards XP to a player and checks if they should level up.
exports.addXP = functions.https.onCall((data, context) => {
    const db = admin.firestore();
   //Break down the request and make sure it is sent correctly.
   const uid = context.auth.uid;
   const addxp = data.xp;
   //if(!uid) throw new functions.https.HttpsError('failed-precondition', 'The function was sent without xp data or authentication.');
   //if(!addxp) throw new functions.https.HttpsError('invalid-argument', 'addXP must be called with one argument containing the amount of xp to award.');
   //Handle the request if it's proper.
   db.collection('users').doc(uid).update({xp: admin.firestore.FieldValue.increment(addxp)}).then(() => {
    db.collection('users').doc(uid).get().then((doc) => {
      let userclass = doc.data().class;
      let nextLvl = 1;
      db.collection('stats').get().then((stats) => {
        stats.forEach((classdoc) => {
          if(classdoc.id == userclass) {
            let xpData = classdoc.data().xp;
            let currentXP = doc.data().xp;
            for(i=2; i<10; i++) {
              if(xpData[i] != null && xpData.i < currentXP){
              nextLvl++
              }
            }
          }
        })
        return db.collection('users').doc(uid).update({level: nextLvl});
      }) 
    })
   });
 });
