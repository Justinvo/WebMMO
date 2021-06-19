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
        initChat();
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
        const stamina = (doc.data().stamina / (heroData.level * 4)) * 100;
        $('#health-enemy').html(`<div class="progress-bar-striped bg-danger progress-bar-animated" role="progressbar" style="width: ${enemyhealth}%;" aria-valuenow="${enemyhealth}" aria-valuemin="0" aria-valuemax="${doc.data().health_enemy_max}"><div class="text-light">Enemy Health: ${doc.data().health_enemy}/${doc.data().health_enemy_max}</div></div>`);
        $('#health-hero').html(`<div class="progress-bar-striped bg-success progress-bar-animated" role="progressbar" style="width: ${herohealth}%;" aria-valuenow="${herohealth}" aria-valuemin="0" aria-valuemax="${doc.data().health_hero_max}"><div class="text-light">Hero Health: ${doc.data().health_hero}/${doc.data().health_hero_max}</div></div>`);
        $('#stamina-hero').html(`<div class="progress-bar-striped bg-warning progress-bar-animated" role="progressbar" style="width: ${stamina}%;" aria-valuenow="${doc.data().stamina}" aria-valuemin="0" aria-valuemax="${heroData.level * 4}"><div class="text-light">Hero Stamina: ${doc.data().stamina}/${heroData.level * 4}</div></div>`);
        //Set battle-log
        //Set battle-log
        const log = doc.data().log;
        $('#battle-log').html('')
        log.forEach((element) => {
          $('#battle-log').append(`<li class='list-group-item'>${element}</li>`);
        })
      })
      //Setup our ability buttons.
      db.collection('data').doc('stats').get().then((doc) => {
        db.collection('data').doc('abilities').get().then((abilitydoc) => {
          $('#attack-light').html(`${heroData.level} Stamina`);
          $('#attack-heavy').html(`${heroData.level*2} Stamina`);
          let abilities = doc.data()[heroData.class].abilities;
          $('#ability-container').html('');
          abilities.forEach((element) => {
            $('#ability-container').append(`<button class="btn btn-primary" onClick='${abilitydoc.data()[element].action}' type="button"><b>${abilitydoc.data()[element].stamina} Stamina </b>${element}: ${abilitydoc.data()[element].description}</button>`);
          })
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
      //Add the description of this location.
      db.collection('locations').doc(currentLocation).get().then((locDesc) => {
        (document.getElementById('current-location-description')).innerText = locDesc.data().description;
      })
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
        //This snapshot contains all user data for our user.
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
        db.collection('data').doc('quests').get().then((doc) => {
          let data = doc.data();
          let keys = Object.keys(doc.data())
          $('#hero-quests-list').html('<p></p>');
          keys.forEach((key) => {
            let quest = data[key];
            //Check level requirements.
            if(quest.lvl_requirement <= heroData.level) {
              let hasRequirements = true;
              //Check quest requirements.
              quest.quest_requirements.forEach((element) => {
                if(!heroData.quests_completed.includes(element)) hasRequirements = false;
              })
              if(hasRequirements)
              {
                //Build objective text string
                let objectives = `<ul class=list-group">`;
                let targets = quest.killtargets;
                targets.forEach((target) => {
                  objectives = objectives + `<li class="list-group-item"><b>Kill: </b>${target.quantity}x ${target.name}</li>`;
                })
                objectives = objectives + "</ul>"
                //Build quest rewards text string
                let rewardText = `<ul class=list-group">`;
                let rewards = quest.rewards
                rewards.forEach((reward) => {
                  rewardText = rewardText + `<li class="list-group-item"><b>Reward: </b>${reward.quantity}x ${reward.id}</li>`;
                })
                rewardText = rewardText + "</ul>"
                //Build full string
                $('#hero-quests-list').append(`
                <ul class=list-group"><b>${key}</b>
                <li class="list-group-item"><b>Quest Giver:</b> ${quest.quest_giver}</li>
                <li class="list-group-item"><b>Quest Description:</b> ${quest.description}</li>
                <li class="list-group-item"><b>Quest Objectives:</b> ${objectives}</li>
                <li class="list-group-item"><b>Quest Rewards:</b> ${rewardText}</li>
                </ul>
                <p></p>
                `)
              } 
            }
          })
      })
      }

    //Display the character's inventory.
    function displayInventory(inventory) {
      //Clear the inventory list first
      $('#hero-inventory-list').html('<p></p>');
      inventory.forEach( element => {
        let n = element.id;
        let q = element.quantity;
        let t = element.tooltip;
        let a = element.action;
        if(t == null || t == undefined) t = "";
        if(a == null || a == undefined) t = "";
        $('#hero-inventory-list').append(`<li class="list-group-item" data-toggle="tooltip" data-bs-placement="top" onClick='addItemToInventory(${element.i}, -1); onClick=${a};'
        title="${t}">${n} <span class="badge bg-info">x${q}
      </span></li>`);  
      })
    }

    //Draw the chat and keep it up to date.
    function initChat() {
      db.collection('data').doc('chat')
        .onSnapshot((doc) => {
          $('#game-menu-chat-list').html('<p></p>');
          const chatData = doc.data().messages;
          for (var i = chatData.length - 1; i >= 0; i--) {
            $('#game-menu-chat-list').append(`<li class="list-group-item" data-toggle="tooltip">${chatData[i]}</li>`)
        }
      })
    }

  //Submit a chat message to the chat.
  function submitChat() {
    let playerRef = db.collection('users').doc(getUserID())
    playerRef.get().then((doc) => {
      const chatmessage = "<b>" + doc.data().name + ":</b> " + (document.getElementById('chat-message-input')).value;
      document.getElementById('chat-message-input').value = "";
      db.collection('data').doc('chat')
        .update({
          messages: firebase.firestore.FieldValue.arrayUnion(chatmessage)
        })
    });
  }


    //////////////////////
    // HELPER FUNCTIONS //
    //////////////////////

    //Add an item to a inventory, grab data from server. Can be used with negative values to remove items. Will wipe item if final quantity reaches <1
    function addItemToInventory(id, quantity) {
      db.collection("data").doc("items").get()
        .then((doc) => {
          let item = doc.data()[id];
          if(quantity > 0) toastr.success(`You received: ${quantity}x ${id}`, 'Item Gained!');
          //Now that we have our item data from the server, let's add it to our inventory.
          let playerRef = db.collection('users').doc(getUserID())
          playerRef.get().then((doc) => {
            //If we have no inventory, add it.
            if(doc.data().inventory[0] == null) {
              let object = {quantity: Number(quantity), id: id, action: item.action, tooltip: item.tooltip, sellable: item.sellable, value: item.value};
              object = prepObject(object);
              let array = [object];
                return playerRef.update({
                  inventory: array
                });
            }
            else{
              //If this item was already in our inventory, change the quantity.
              let inventory = doc.data().inventory;
              let counter = -1;
              let index = -1;
              inventory.forEach((element) => {
                counter++
                if(element.id == id) {
                  index = counter;
                }
              }) 
              if(quantity+inventory[counter].quantity > 0)
              {
                let object = { id: id, quantity: Number(quantity)+Number(inventory[counter].quantity), action: item.action, tooltip: item.tooltip, value: item.value};
                object = prepObject(object);
                inventory[counter] = object;
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
          })
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

    //Get class data
    async function getClassData() {
      let doc = await db.collection("data").doc("stats").get();
      return doc.get(heroData.class);
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
            if(xpdata[i] <= userdoc.data().xp) {
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
    toastr.success(`<b>Congrats! You have leveled up and are now level ${newLevel}!</b>`, 'Level up!');
  }

  //Start a battle
  function startBattle(enemy) {
    toggleLoadingState(true);
    if(getHealth().current <= 0) toastr.warning("You can't start a battle while being unconscious. Regain health by paying a priest or by watching an ad in the game options.", "Hold up there...")
      //Check that our player is not currently in a fight.
  db.collection('fights').doc(getUserID()).get().then((doc) => {
    if(doc.exists || getHealth().current <= 0) { 
      toggleLoadingState(false);
    }
    else {
      db.collection('data').doc('enemies').get().then((enemyData) => {
        const enemyObject = enemyData.data()[enemy];
        const dataObject = {name: getUserID(), 
          enemy: enemy, 
          base_attack: enemyObject.base_attack,
          base_attack_min: enemyObject.base_attack_min,
          base_attack_max: enemyObject.base_attack_max,
          health_enemy: enemyObject.health, 
          health_hero: getHealth().current, 
          stamina: Number(heroData.level) * 4,
          health_enemy_max: enemyObject.health,
          health_hero_max: getHealth().max, 
          log: ["<b>1:</b> The battle starts!"], 
          xp: enemyObject.xp}
          db.collection('fights').doc(getUserID()).set(dataObject).then(() => {
            toggleLoadingState(false);
            window.location = "battle.html";
          })
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

//Attack in battle. Takes damage and staminacost and optional attackDescription.
function attackInBattle(damage, staminaCost, attackDescription) {
  toggleLoadingState(true);
  const uid = getUserID();
  //Add the damage to the enemy and add a log.
  db.collection('fights').doc(uid).get().then((doc) => {
    if (doc.data().health_enemy != 0 && doc.data().health_hero != 0) {
      if(doc.data().stamina >= staminaCost) {
      //regain stamina every turn. Clamp to max and min.
      let stamina = Number(doc.data().stamina) + (Number(heroData.level) / 2) - staminaCost;
      if(stamina > heroData.level * 4) stamina = heroData.level * 4;
      if(stamina < 0) stamina = 0;
      //deplete enemy health.
      var newenemyhealth = doc.data().health_enemy - damage;
      if(newenemyhealth < 0) newenemyhealth = 0;
      //Calculate enemy damage.
      const enemyDamage = doc.data().base_attack + (getRandomInt(doc.data().base_attack_max - doc.data().base_attack_min)+doc.data().base_attack_min)
      var newherohealth = doc.data().health_hero - enemyDamage;
      if(newherohealth < 0) newherohealth = 0;
      //Create new log message.
      let attackString = "";
      if(attackDescription) {attackString = `<b>${doc.data().log.length + 1}: Hero</b> attacks ${doc.data().enemy} using ${attackDescription} for ${damage} damage!`}
      else { attackString = `<b>${doc.data().log.length + 1}: Hero</b> attacks ${doc.data().enemy} for ${damage} damage!`}
      db.collection('fights').doc(uid).update({
        health_enemy: newenemyhealth,
        stamina: stamina,
        log: firebase.firestore.FieldValue.arrayUnion(attackString)
      }).then(() => {
        //Add the damage to the player and add a log.
        db.collection('fights').doc(uid).update({
          health_hero: newherohealth,
          log: firebase.firestore.FieldValue.arrayUnion(`<b>${doc.data().log.length + 1}: ${doc.data().enemy}</b> attacks Hero for ${enemyDamage} damage!`)
        }).then(() => {
          setHeroHealth(newherohealth);
          checkBattleProgress();
        });
      })
      }
      else {
        toastr.warning(`You cannot use this move as you need ${staminaCost} stamina but only have ${doc.data().stamina} stamina available.`, "Can't use that move!")
        toggleLoadingState(false);
      }
    }
    else {
      toggleLoadingState(false);
    }
  })
}

function restoreHealthInBattle(health) {
  toggleLoadingState(true);
  const uid = getUserID();
  //Add the damage to the enemy and add a log.
  db.collection('fights').doc(uid).get().then((doc) => {
    if (doc.data().health_enemy != 0 && doc.data().health_hero != 0) {
      const enemyDamage = doc.data().base_attack + (getRandomInt(doc.data().base_attack_max - doc.data().base_attack_min))
      var newherohealth = doc.data().health_hero - enemyDamage + health;
      if(newherohealth < 0) newherohealth = 0;
      db.collection('fights').doc(uid).update({
        log: firebase.firestore.FieldValue.arrayUnion(`<b>${doc.data().log.length + 1}: Hero</b> heals ${health} points of health!`)
      }).then(() => {
        //Add the damage to the player and add a log.
        db.collection('fights').doc(uid).update({
          health_hero: newherohealth,
          log: firebase.firestore.FieldValue.arrayUnion(`<b>${doc.data().log.length + 1}: ${doc.data().enemy}</b> attacks Hero for ${enemyDamage} damage!`)
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
    //Enemy has died! Victory:
    if(doc.data().health_enemy <= 0) {
      db.collection('fights').doc(uid).update({
        log: firebase.firestore.FieldValue.arrayUnion(`<b>${doc.data().log.length+1}: Hero</b> has defeated the ${doc.data().enemy} and has gained ${doc.data().xp} XP!`)
      }).then(() => {
        addXP(doc.data().xp);
        awardLoot(doc.data().enemy);
        finishBattle();
        toggleLoadingState(false);
        toastr.success(`Congratulations! You defeated ${doc.data().enemy}.`, 'Victory!');
      });
    }
    //Hero has died.. Defeat:
    else if(doc.data().health_hero <= 0) {
      db.collection('fights').doc(uid).update({
        log: firebase.firestore.FieldValue.arrayUnion(`<b>${doc.data().log.length+1}: ${doc.data().enemy}</b> has defeated the Hero...`)
      }).then(() => {
        finishBattle();
        toggleLoadingState(false);
        toastr.error(`Oh no! You have been defeated by ${doc.data().enemy}.`, 'Defeat...');
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

//Award loot to the player upon victory.
function awardLoot(id) {
  db.collection("data").doc('enemies').get().then((doc) => {
    const data = doc.get(id).rewards;
    addItemToInventory(data.i, data.q);
    db.collection('data').doc('items').get().then((items) => {
      const item = items.data()[data.i]
      db.collection('fights').doc(getUserID()).update({
        log: firebase.firestore.FieldValue.arrayUnion(`<b>Result: </b>The Hero gained ${data.q}x ${item.name}!`)
      })
    })
  })
}


  //function setLoadingState: toggle the status of the loading screen.
  //TODO: add manual time-out
  function toggleLoadingState(status) {
    const loadingScreenTexts = [
      "Convincing the shopkeeper your gold is real...",
      "Attempting to catch frogs from a pond...",
      "Allying with the frog people for the coming war...",
      "Collecting coins from the city fountains...",
      "Finding the best way to travel there...",
      "Is a Komodo Dragon really a Dragon???",
      "Where do all the Geese go at night?",
      "Are the Geese at the park actually free?",
      "Gears go ⚙️ ⚙️ ⚙️...",
      "🐸 + 🐦 = 🐉?",
      "Improvising the next part of the story...",
      "Bleep Bloop. Yes.",
      "Is it really a toll payment if the alternative is death?",
      "🦙",
      "Hello there, friend. See you soon.",
      "Wow",
      "Finding where we left that...",
      "Please wait, constructing a new game.",
      "Congrats! You are the 1000th customer of the day.",
      "Ooooh, I'm not sure if that was the best move...",
      "Enjoying the game? Good.",
      "Thanks for Playing!",
      "WebMMO? More Like WebMOO, am I right?",
      "You know what, never mind.",
      "Hey there!"
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
      document.getElementById('loading-screen-text').innerText = loadingScreenTexts[getRandomInt(loadingScreenTexts.length-1)];
      loadingScreen = new bootstrap.Modal(document.getElementById('loading-screen'), {
        keyboard: false, backdrop: "static"
      })
      
      loadingScreen.show();
    }

  }

  //Get a random int in range of 0 to max.
  function getRandomInt(max) {
    return Math.floor(Math.random() * max);
  }

  //Function to prep a object for upload to firestore
  function prepObject(object) {
    object = JSON.stringify(object);
    object = JSON.parse(object);
    return object;
  }

  //Function to clamp inclusively to min and max.
  function clamp(number,min,max) {
    if(number >= min && number <= max) return number;
    if(number < min) return min;
    if(number > max) return max;
  }