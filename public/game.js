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
    //Start the game as soon as we are logged in.
    function initGame() {
        //Initialize our character.
        pullCharacterInfo();
        updateLocation("Town Center");
        getTime()
        //classData = await getClassData();
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
          doc.data().enemies.forEach( element => {
              $('#current-location-enemies-list').append(`<li class='list-group-item'><button class='btn btn-danger' type='button'>${element}</button></li>`); 
              console.log(element)
          });
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
          heroNameText.innerText = heroData.name;
          heroLevelText.innerText = heroData.level;
          heroClassText.innerText = heroData.class;
          heroHealthText.innerText = `${getHealth().current} / ${getHealth().max} `
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
        if(t == null || t == undefined) t = "";
        $('#hero-inventory-list').append(`<li class="list-group-item" data-toggle="tooltip" data-bs-placement="top"
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
              let object = { i: id, q: quantity, n: item.name };
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
                let object = { i: id, q: quantity+inventory[index].q, n: item.name };
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
                let object = { i: id, q: quantity, n: item.name };
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

  //Get health object
  function getHealth() {
   const maxHealth = classData.max_health_base + classData.extra_health_per_level * heroData.level;
   const currentHealth = heroData.health_current;
   return {current: currentHealth, max: maxHealth};
  }

