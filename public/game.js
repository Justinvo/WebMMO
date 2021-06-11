    /*
 * Copyright 2021 Justin Van Oort. All Rights Reserved.
 * This is the client-side game code for WebMMO.
 */
    
    
    //Globals:
    var currentLocation;
    var heroData;
    var classData;
    var locAmountSubscription;
    var date;
    var loadingScreen;
    
    //Start the game as soon as we are logged in.
    function initGame() {
        //Initialize our character.
        pullCharacterInfo();
        updateLocation("Town Center");
        getTime()
    }

    //Globals for battle:
    var fightData;
    var fightSnapshot;
    //Start a battle screen.
    function initBattle() {
      //Grab data about our fight.
      db.collection('fights').doc(getUserID()).get().then((doc) => {
        fightData = doc.data();
        //Set enemy name.
        document.getElementById('battle-enemy-name').innerText = "Fighting: " + doc.data().enemy;
      })
      //Keep track of the battle-data.
      fightSnapshot = db.collection('fights').doc(getUserID())
        .onSnapshot((doc) => {
        //Set health bars
        const enemyhealth = (doc.data().health_enemy / doc.data().health_enemy_max) * 100;
        const herohealth = (doc.data().health_hero / doc.data().health_hero_max) * 100;
        $('#health-enemy').html(`<div class="progress-bar-striped bg-danger progress-bar-animated" role="progressbar" style="width: ${enemyhealth}%;" aria-valuenow="${enemyhealth}" aria-valuemin="0" aria-valuemax="${doc.data().health_enemy_max}"><div class="text-light">Enemy: ${doc.data().health_enemy}/${doc.data().health_enemy_max}</div></div>`);
        $('#health-hero').html(`<div class="progress-bar-striped bg-success progress-bar-animated" role="progressbar" style="width: ${herohealth}%;" aria-valuenow="${herohealth}" aria-valuemin="0" aria-valuemax="${doc.data().health_hero_max}"><div class="text-light">Hero: ${doc.data().health_hero}/${doc.data().health_hero_max}</div></div>`);
        //Set battle-log
        const log = doc.data().log;
        $('#battle-log').html('')
        log.forEach((element) => {
          $('#battle-log').append(`<li class='list-group-item'>${element}</li>`);
        })
      })
    }

    //Add buttons for going to different locations. Lock or Hide certain elements depending on level or quest conditions.
    //TODO: Move conditions into firestore getter.
    function initLocations() {
        $('#game-menu-location-list').html('<p></p>');
        const locRefs = db.collection("locations").orderBy("order", "asc");
        locRefs.get().then((query) => {
            query.forEach((doc) => {
                let data = doc.data();
                //First check the level requirement.
                if(data.lvl_requirement == null || data.lvl_requirement <= heroData.level)
                {
                    //Then check the quest requirement.
                    if(data.quest_requirement == null || heroData.quests_completed.includes(data.quest_requirement)) 
                    {
                        const buttonString = `<li class='list-group-item'><button class='btn btn-primary' type='button' onClick='updateLocation("` + `${doc.id}` +  `")'>${doc.id}</button></li>`
                        $('#game-menu-location-list').append(buttonString); 
                    }
                }
                else if(data.lvl_requirement != null && data.lvl_requirement == heroData.level + 1) {
                  const buttonString = `<li class='list-group-item'><button class='btn btn-primary' data-toggle="tooltip" data-bs-placement="top"
                  title="Unlocked at level ${heroData.level + 1}." type='button'>${doc.id} <span class="badge bg-secondary">🔒</span></button></li>`
                        $('#game-menu-location-list').append(buttonString); 
                }
            })
        })
         
    }
    
    //Change the current location of the player.
    function updateLocation(newLocation) {
    if(newLocation && newLocation != currentLocation)
    {
      if(currentLocation)
      {
        // Atomically remove the player from the previous location, if necessary.
        let locRef = db.collection('locations').doc(currentLocation);
        locRef.update({
          players: firebase.firestore.FieldValue.arrayRemove(getUserID())
        });
      }
      //Update the location first.
      currentLocation = newLocation;
      let locText = document.getElementById("current-location-text");
      locText.innerText = currentLocation
      //Unsubscribe from any  previous listeners
      if (locAmountSubscription) locAmountSubscription();
      //Add our player id to the location list of our new location.
      let locRef = db.collection('locations').doc(currentLocation);
      locRef.update({
        players: firebase.firestore.FieldValue.arrayUnion(getUserID())
      });
      //Keep track of how many players are here. Auto updates if this changes.
      let locAmountText = document.getElementById("current-location-players-amount-text");
      locAmountSubscription = db.collection("locations").doc(currentLocation)
        .onSnapshot((doc) => {
          if (doc.data().players.length != 1) {
            locAmountText.innerText = "There are currently " + doc.data().players.length + " players in the " + currentLocation;
          }
          else {
            locAmountText.innerText = "There is currently 1 player in the " + currentLocation;
          }
          //Update the player names list.
          $('#current-location-players-names-list').html('');
          doc.data().players.forEach( element => {
            let nameRef = db.collection("users").doc(element);
            nameRef.get().then((doc) => {
              let name = doc.data().name;
              $('#current-location-players-names-list').append(`<li class="list-group-item">${name}</li>`);  
            })
          });
          //Update the available enemies.
          $('#current-location-enemies-list').html('');
          db.collection('fights').doc(getUserID()).get().then((fightdoc) => {
            //Show re-join battle if battle is active.
            if(fightdoc.exists) {
              $('#current-location-enemies-list').append(`<button class='btn btn-danger' type='button' onClick='function() { window.location = battle.html}>Continue Battle</button>`)
            }
            //Show normal buttons if there is no active battle.
            else {
              doc.data().enemies.forEach( element => {
                const buttonString = `<li class='list-group-item'><button class='btn btn-danger' type='button' onClick='startBattle("` + `${element}` +  `")'>${element}</button></li>`
                $('#current-location-enemies-list').append(buttonString);  
              });
            }
          })
        });
    }
    }
    
    //Get our character's info and keep it up to date.
    function pullCharacterInfo() {
        db.collection("users").doc(getUserID())
        .get().then((doc) => {
          heroData = doc.data();
          getClassData().then((data) => {
            classData = data;
          })
        })
        db.collection("users").doc(getUserID())
        .onSnapshot((doc) => {
          getClassData().then((data) => {
            classData = data;
            heroData = doc.data();
          let heroNameText = document.getElementById('hero-name');
          let heroLevelText = document.getElementById('hero-level');
          let heroClassText = document.getElementById('hero-class');
          let heroHealthText = document.getElementById('hero-health');
          let heroXPText = document.getElementById('hero-xp');
          heroNameText.innerText = heroData.name;
          heroLevelText.innerText = heroData.level;
          heroClassText.innerText = heroData.class;
          heroHealthText.innerText = `${getHealth().current} / ${getHealth().max} `
          heroXPText.innerText = `${getXP().current} / ${getXP().next} `
          displayInventory(heroData.inventory);
          initLocations();
          })
        });
      }

    //Display the character's inventory.
    function displayInventory(inventory) {
      //Clear the inventory list first
      $('#hero-inventory-list').html('<p></p>');
      inventory.forEach( element => {
        let n = element.n;
        let q = element.q;
        let t = element.t;
        let a = element.a;
        if(t == null || t == undefined) t = "";
        $('#hero-inventory-list').append(`<li class="list-group-item" data-toggle="tooltip" data-bs-placement="top" onClick='addItemToInventory(${element.i}, -1); onClick=${a};'
        title="${t}">${n} <span class="badge bg-info">x${q}
      </span></li>`);  
      })
    }

    //////////////////////
    // HELPER FUNCTIONS //
    //////////////////////

    //TODO: Move to server-side.
    //Add an item to a inventory, grab data from server. Can be used with negative values to remove items. Will wipe item if final quantity reaches <1
    function addItemToInventory(id, quantity) {
      const itemRef = db.collection("data").doc("items").get()
        .then((doc) => {
          let item = doc.data()[id];
          //Now that we have our item data from the server, let's add it to our inventory.
          let playerRef = db.collection('users').doc(getUserID())
          playerRef.get().then((doc) => {
            //If we have no inventory, add it.
            if(doc.data().inventory[0] == null) {
              let object = { i: id, q: quantity, n: item.name, a: item.action, t: item.tooltip};
                return playerRef.update({
                  inventory: firebase.firestore.FieldValue.arrayUnion(object)
                });
            }
            else{
            //Try to find the item in our inventory first.
            let index = -1;
            doc.data().inventory.forEach(element => {
              index++
              if(element.i == id) {
              //If this item was already in our inventory, change the quantity.
              let inventory = doc.data().inventory;
              if(quantity+inventory[index].q > 0)
              {
                let object = { i: id, q: quantity+inventory[index].q, n: item.name, a: item.action, t: item.tooltip };
                inventory[index] = object;
                return playerRef.update({
                  inventory: inventory
                })
              }
              //Wipe item if quantity is less than 1.
              else
                {
                 inventory =  inventory.filter(function(e) { return e.i !== id })
                  return playerRef.update({
                    inventory: inventory
                  })
                }
              }
              else {
                let object = { i: id, q: quantity, n: item.name, a: item.action, t: item.tooltip };
                return playerRef.update({
                  inventory: firebase.firestore.FieldValue.arrayUnion(object)
                });
              }
          })
            }
        });
      })
    }

    //Get the current userID, that is returned from firestore auth. Only available after initGame()
    function getUserID() {
        return firebase.auth().currentUser.uid;
    }

     //Get the current user object, that is returned from firestore auth. Only available after initGame()
     function getUser() {
        return firebase.auth().currentUser;
    }

    //Get time zone object.
    function getTime() {
        // Get JSON object
        $.getJSON('http://worldtimeapi.org/api/timezone/Europe/Amsterdam', function (data) {
          date = new Date(data.datetime)
          document.getElementById('current-location-time').innerText = date.toUTCString();
          setInterval(updateTime, 1000);

        });
    }

    //update time zone object.
    function updateTime() {
      let n = date.valueOf()
      n = n+1000;
      date = new Date(n);
      document.getElementById('current-location-time').innerText = date.toUTCString();
    }

    //Get class data
    async function getClassData() {
      let doc = await db.collection("data").doc("stats").get();
      return doc.get(heroData.class);
      throw new Error("No such document");
  }

  //Get health object that has our current health and max health.
  function getHealth() {
   const maxHealth = classData.max_health_base + classData.extra_health_per_level * heroData.level;
   const currentHealth = heroData.health_current;
   return {current: currentHealth, max: maxHealth};
  }

  //Get XP object that has our current xp and the XP required for next level.
  function getXP() {
    const currentXP = heroData.xp;
    const xpData = classData.xp;
    let nextLvl = 2;
    while(xpData[nextLvl] < currentXP) {
      nextLvl++
    }
    return {current: currentXP, next: xpData[nextLvl]}

  }

  //Add XP to player and calculate new level if needed.
  function addXP(addxp) {
    db.collection('users').doc(getUserID()).update({xp: firebase.firestore.FieldValue.increment(addxp)}).then(() => {  
      db.collection('users').doc(getUserID()).get().then((userdoc) => {
        db.collection('data').doc('stats').get().then((classdoc) => {
          const heroclass = userdoc.data().class;
          const xpdata = classdoc.data()[heroclass].xp;
          var level = 1;
          let i = 2;
          for(i; i < 7; i++)
          {
            if(xpdata[i] < userdoc.data().xp) {
              level++
            }
          }
          if(userdoc.data().level != level) {
            db.collection('users').doc(getUserID()).update({level: level}).then(() => {
              playerLevelUp(level);
            })
          }
        });
      });
    });
  }

  //Feedback for if the player levelled up.
  function playerLevelUp(newLevel) {
    console.log("congrats you are now level: " + newLevel);
  }

  //Start a battle
  //TODO: use enemy data.
  function startBattle(enemy) {
    toggleLoadingState(true);
      //Check that our player is not currently in a fight.
  db.collection('fights').doc(getUserID()).get().then((doc) => {
    if(doc.exists) { 
      toggleLoadingState(false);
    }
    else {
      const dataObject = {name: getUserID(), enemy: enemy, health_enemy: 10, health_hero: getHealth().current, health_enemy_max: 10, health_hero_max: 25, log: ["<b>1:</b> The battle starts!"], xp: 10}
        db.collection('fights').doc(getUserID()).set(dataObject).then(() => {
          toggleLoadingState(false);
          window.location = "battle.html";
        })
    }
  })
  }

  //Flee a battle
  function endBattle() {
    toggleLoadingState(true);
    fightSnapshot();
    const uid = getUserID();
      //Check that our player is currently in a fight.
  db.collection('fights').doc(uid).get().then((doc) => {
    if(doc.exists) {
      db.collection('fights').doc(uid).delete().then(() => {
        toggleLoadingState(false);
        window.location = "game.html";
      });
    }    
  })
}

//Attack in battle
function attackInBattle(damage) {
  toggleLoadingState(true);
  const uid = getUserID();
  //Add the damage to the enemy and add a log.
  db.collection('fights').doc(uid).get().then((doc) => {
    if (doc.data().health_enemy != 0 && doc.data().health_player != 0) {
      var newenemyhealth = doc.data().health_enemy - damage;
      if(newenemyhealth < 0) newenemyhealth = 0;
      var newherohealth = doc.data().health_hero - 2;
      if(newherohealth < 0) newherohealth = 0;
      db.collection('fights').doc(uid).update({
        health_enemy: newenemyhealth,
        log: firebase.firestore.FieldValue.arrayUnion(`<b>${doc.data().log.length + 1}: Hero</b> attacks ${doc.data().enemy} for ${damage} damage!`)
      }).then(() => {
        //Add the damage to the player and add a log.
        db.collection('fights').doc(uid).update({
          health_hero: newherohealth,
          log: firebase.firestore.FieldValue.arrayUnion(`<b>${doc.data().log.length + 1}: ${doc.data().enemy}</b> attacks Hero for 2 damage!`)
        }).then(() => {
          setHeroHealth(newherohealth);
          checkBattleProgress();
        });
      })
    }
    else {
      toggleLoadingState(false);
    }
  })
}

//Check if the enemy we are fighting is dead or that the player died.
function checkBattleProgress() {
  const uid = getUserID();
  db.collection('fights').doc(uid).get().then((doc) => {
    if(doc.data().health_enemy <= 0) {
      db.collection('fights').doc(uid).update({
        log: firebase.firestore.FieldValue.arrayUnion(`<b>${doc.data().log.length+1}: Hero</b> has defeated the ${doc.data().enemy} and has gained ${doc.data().xp} XP!`)
      }).then(() => {
        addXP(doc.data().xp);
        finishBattle();
        toggleLoadingState(false);
      });
    }
    else if(doc.data().health_hero <= 0) {
      db.collection('fights').doc(uid).update({
        log: firebase.firestore.FieldValue.arrayUnion(`<b>${doc.data().log.length+1}: ${doc.data().enemy}</b> has defeated the Hero...`)
      }).then(() => {
        finishBattle();
        toggleLoadingState(false);
      });
    }
    else toggleLoadingState(false);
  });
}

//set the hero's health.
function setHeroHealth(newHealth) {
  db.collection('users').doc(getUserID()).get().then((doc) => {
    var newHealthValue = newHealth;
    if(newHealth < 0) newHealthValue = 0;
    if(newHealth > getHealth().max) newHealthValue = getHealth().max;
    db.collection('users').doc(getUserID()).update({
      health_current: newHealthValue
    })
  })
}

//helper function to restore health.
function restoreHealth(healthToRestore) {
  setHeroHealth(getHealth().current + healthToRestore);
}

//set flee button to leave battle.
function finishBattle() {
  const button = document.getElementById('flee-battle-text');
  button.innerText = "Leave Battle"
}

  //function setLoadingState: toggle the status of the loading screen.
  //TODO: add manual time-out
  function toggleLoadingState(status) {
    const loadingScreenTexts = [
      "Convincing the shopkeeper your gold is real...",
      "Attempting to catch frogs from a pond..."
    ]
    if(!status) {
      //If the callback is received (fast internet, empty server, etc) then it's possible that the 
      //previous transition was not yet completed, in that case, the normal hide call will get ignored.
      //to fix this we add a event listener to the end of the shown transition, but only after we are done.
      //this causes the first hide method call to get ignored, which is fine as we call it again right after the modal is shown.
      let loadingScreenEle = document.getElementById('loading-screen')
      loadingScreenEle.addEventListener('shown.bs.modal', function (event) {
        loadingScreen.hide();
      })
      loadingScreen.hide();
    }
    else {
      loadingScreen = new bootstrap.Modal(document.getElementById('loading-screen'), {
        keyboard: false, backdrop: "static"
      })
      loadingScreen.show();
    }

  }