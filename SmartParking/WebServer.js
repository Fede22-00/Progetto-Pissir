'use strict';

//---------------LIBRERIE
const https = require('https');
const http = require('http');
const fs = require('fs');
const path = require('path');
const url= require('url');
const db = require('./db');
const jwt=require('jsonwebtoken')
const querystring = require('querystring');
const support=require('./supportFunctions');
const { Worker, isMainThread} = require('worker_threads');

//-----------------------------DATI DEL SERVER KEYCLOAK
const keycloak = {
  "realm": "SmartParking",
  "auth-server-url": "http://localhost:8080/",
  "ssl-required": "external",
  "resource": "myclient",
  "verify-token-audience": true,
  "credentials": {
    "secret": "2Q4abiEbYMV15pX4fIO2AYqFdWhCdjVM"
  },
  "confidential-port": 0,
  "policy-enforcer": {
    "credentials": {}
  }
};

//=================================================================================================|
//==================================== [WEB API REST] =============================================|
//=================================================================================================|

//---------certificato e chiave privata per https
var options = {
  key: fs.readFileSync('./ssl/https-web/server.key'),
  cert: fs.readFileSync('./ssl/https-web/server.crt')
};

//variabili per cambiare pagina
  let nameFile;
  let contentType;
  let filePath;

//CREAZIONE DEL SERVER
const server = https.createServer(options,async (req, res) => {

    //divido l'url in path e query
    const { pathname, query } = url.parse(req.url);
    const queryParams = querystring.parse(query);
    
    console.log("pathname -> "+pathname);


    // Homepage
    if (req.method === 'GET' && pathname === '/') {
        nameFile='root';
        filePath = path.join(__dirname, 'public/views', `${nameFile}.html`);
        contentType = 'text/html'
        support.readFile(filePath,contentType,res);
    }
    
    //--------------------------------------------------------OAUTH 2.0
    // url se viene richiesto l'accesso
    else if(req.method === 'GET' && pathname === '/auth/keycloak'){
      // L'utente non è autenticato, effettua il reindirizzamento a Keycloak per l'autenticazione
        const redirectUrl = `${keycloak["auth-server-url"]}/realms/${keycloak["realm"]}/protocol/openid-connect/auth` +
        `?client_id=${keycloak["resource"]}`+
        `&redirect_uri=https://localhost:8443/auth/keycloak/callback`+
        `&response_type=code`; // L'URL a cui verrai reindirizzato dopo l'autenticazione
      res.writeHead(301, { Location: redirectUrl });
      res.end();
    }

    //url di callback dopo l'accesso
    else if(req.method === 'GET' && pathname === '/auth/keycloak/callback'){
      if(queryParams.code){
        const auth_code = queryParams.code;
        const requestBody = querystring.stringify({
          grant_type: 'authorization_code',
          code: auth_code,
          client_id: keycloak["resource"],
          client_secret: keycloak["credentials"]["secret"],
          redirect_uri: "https://localhost:8443/auth/keycloak/callback",
        });
      
        const options = {
          hostname: "localhost",
          port: 8080,
          path: `/realms/${keycloak["realm"]}/protocol/openid-connect/token`,
          method: 'POST',
          headers: {
            'Content-Type': 'application/x-www-form-urlencoded',
            'Content-Length': requestBody.length,
          },
        };
      
        const request = http.request(options, (response) => {
          let data = '';
      
          response.on('data', (chunk) => {
            data += chunk;
          });
      
          response.on('end', () => {
            const tokenData = JSON.parse(data);
            const access_token = tokenData.access_token
            const username=(jwt.decode(access_token))["preferred_username"]
            res.writeHead(301,{"Location":`/admin?admin_username=${username}`})
            res.end()
          });
        });
      
        request.on('error', (error) => {
          console.log(error)
        });
      
        request.write(requestBody);
        request.end();
      }
    }

    //---------------------------------------------------------AREA AMMINISTRATORE
    // Pagina amministratore
    else if (req.method === 'GET' && pathname === '/admin') {
      if(queryParams.admin_username){
          nameFile='admin';
          filePath = path.join(__dirname, 'public/views', `${nameFile}.html`);
          contentType = 'text/html'
          support.readFile(filePath,contentType,res);
      }
     else{
        res.writeHead(301,{"Location":"/auth/keycloak"})
        res.end()
      }
    }
    
     // PUT "/admin/changeStatusParking" per cambiare lo stato di un parcheggio
     else if (req.method === 'PUT' && pathname === '/admin/changeStatusParking') {

      // Inizializzare una stringa per memorizzare i dati ricevuti
      let body = '';
      
      // Gestire i dati ricevuti
      req.on('data', (chunk) => {
       body += chunk;
      });

      // Alla fine dei dati ricevuti
      req.on('end', () => {
      try {
          // Parsifico i dati JSON ricevuti
          const data = JSON.parse(body).split(":");

          //Metto i dati in un oggetto per comodità
          const values={"id":data[0], "currentStatus":data[1]}
          //preparo il nuovo valore che è l'opposto di quello attuale
          var newValue=(values.currentStatus==0)?1:0;

          // Qui puoi gestire i dati come preferisci, ad esempio aggiornando un database
          const sqlChangeStatusParking='UPDATE Parcheggi SET Stato = ? WHERE ID = ?'
          db.run(sqlChangeStatusParking, [newValue, values.id], function(err) {
              if (err) {
                return console.error(err.message);
              }
              console.log(`SERVER: Modificato il parcheggio con ID ${values.id} con il nuovo valore "${newValue}"`);
            });
          // Rispondi con una conferma
          
          res.writeHead(200, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ message: 'Dati aggiornati con successo'}));
          
      } catch (error) {
          // Se c'è un errore nel parsing dei dati JSON
          res.writeHead(400, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ message: 'Errore nella richiesta: dati JSON non validi' }));
      }
      });

    }
    
    //POST "/admin/addNewParking" per aggiungere un nuovo parcheggio
      else if (req.method === 'POST' && pathname === '/admin/addNewParking'){
      // Inizializzare una stringa per memorizzare i dati ricevuti
      let body = '';
      
      // Gestire i dati ricevuti
      req.on('data', (chunk) => {
       body += chunk;
      });

      // Alla fine dei dati ricevuti
      req.on('end', () => {
      try {
          const newID=support.makeid(10);
          // Parsifico i dati JSON ricevuti
          const data = JSON.parse(body);
          const values={"zone":data["zone"],"spots":data["spots"]};
          // Qui puoi gestire i dati come preferisci, ad esempio aggiornando un database
          const sqlInsertNewParking='INSERT INTO Parcheggi VALUES (?,?,?,?)'
          db.run(sqlInsertNewParking, [newID,values.zone,values.spots,0], function(err) {
              if (err) {
                return console.error(err.message);
              }
              console.log(`SERVER: Aggiunto nuovo parcheggio al database`);
            });
          // Rispondi con una conferma
          
          res.writeHead(200, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ message: 'Parcheggio aggiunto con successo'}));
          
      } catch (error) {
          // Se c'è un errore nel parsing dei dati JSON
          res.writeHead(400, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ message: 'Errore nella richiesta: dati JSON non validi' }));
      }
      });
    }
    
    //DELETE "/admin/removeParking" per eliminare un parcheggio
      else if (req.method === 'DELETE' && pathname === '/admin/removeParking'){
      // Inizializzare una stringa per memorizzare i dati ricevuti
      let body = '';
      
      // Gestire i dati ricevuti
      req.on('data', (chunk) => {
       body += chunk;
      });

      // Alla fine dei dati ricevuti
      req.on('end', () => {
      try {
          // Parsifico i dati JSON ricevuti
          const idParkingToRemove = JSON.parse(body);

          const sqlDeleteNewParking='DELETE FROM Parcheggi WHERE ID = ?'
          db.run(sqlDeleteNewParking, [idParkingToRemove], function(err) {
              if (err) {
                return console.error(err.message);
              }
              console.log(`SERVER: Cancellato parcheggio dal database`);
            });
          // Rispondi con una conferma
          
          res.writeHead(200, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ message: 'Parcheggio rimosso con successo'}));
          
      } catch (error) {
          // Se c'è un errore nel parsing dei dati JSON
          res.writeHead(400, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ message: 'Errore nella richiesta: dati JSON non validi' }));
      }
      });
    }

    //---------------------------------------------------------AREA UTENTE
    // GET Pagina Utente
    else if (req.method === 'GET' && pathname === '/user') {
      nameFile='user';
      filePath = path.join(__dirname, 'public/views', `${nameFile}.html`);
      contentType = 'text/html'
      support.readFile(filePath,contentType,res);
  }

    //--------------------------------------------------------GENERICI
    //GET tutti i dati dei parcheggi
      else if (req.method === 'GET' && pathname === '/getAllParkings') {
        // Imposta l'intestazione della risposta come JSON
        res.setHeader('Content-Type', 'application/json');
        db.all('SELECT * FROM Parcheggi', (err, rows) => {
            if (err) {
                res.writeHead(505, { 'Content-Type': 'text/plain' });
                res.end('Errore nel database');
              return;
            }
            res.end(JSON.stringify(rows)); // Invia i dati come risposta JSON
          });
        
    }

    // Gestisci richieste GET per la pagina CSS e Javascript, nameFile contiene il nome della pagina da caricare
    else if (req.method === 'GET' && (pathname.endsWith('.css') || pathname.endsWith('.js'))) {
        if(req.url.endsWith('.css')){
           filePath = path.join(__dirname, 'public/stylesheets', `${nameFile}.css`);
           contentType = 'text/css';
        }
        else{
           filePath = path.join(__dirname, 'public/javascripts', `${nameFile}.js`);
           contentType = 'application/javascript';
        }
        support.readFile(filePath,contentType,res);
    }

    // Nel caso non esista la pagina
    else {
        res.writeHead(404, { 'Content-Type': 'text/plain' });
        res.end('Page not found');
    }
});

// Avvio del server sulla porta sicura
const port = 8443;
server.listen(port, () => {
  console.log(`Server in ascolto sulla porta ${port}`);
});


//=================================================================================================|
//========================================== [MQTT] ===============================================|
//=================================================================================================|

//============================================================================
//                       |Gestore funzionamento dei device|
//============================================================================

//Gestisce la sbarra di ingresso
async function handleEntry(id_parking) {

  try {
    //estraggo i dati di un certo parcheggio
    let rowData=await getRowParkingByID(id_parking);
    if(rowData===undefined){
      throw new Error("Il parcheggio non esiste");
    }
    //prima controllo se il parcheggio è chiuso o aperto
    if(rowData["Stato"]==1)return "Parcheggio chiuso, non puoi entrare"

    //controllo il numero di posti disponibili nel parcheggio
    const spots=rowData["Posti"];
  
      //se i posti sono >0 allora:
      if(spots>0){
        
        //1 - genero un ticket per l'utente e lo metto nella tabella "Tickets"
                //{IDticket , IDparking}
        const IDticket=support.makeid(20);
        const sqlInsertNewTicket="INSERT INTO Tickets (IDticket,IDparking) VALUES (?,?)";
        db.run(sqlInsertNewTicket,[IDticket,id_parking],(err,row)=>{
          if (err) {
            console.error(err.message);
            throw new Error(err.message)
          }
          else console.log(`DATABASE: Nuovo ticket inserito: [${IDticket},${id_parking}]`);
        })
        
        //2 - decremento i posti alla tabella "Parcheggi" del database
        const sqlDecreaseSpots="UPDATE Parcheggi SET Posti = ? WHERE ID = ?";
        const newValueSpots=spots-1;

        db.run(sqlDecreaseSpots,[newValueSpots,id_parking], (err) => {
          if (err) {
            console.error(err.message);
            throw new Error(err.message);
          }
          else console.log("DATABASE: Posto decrementato");
        })

        //3 - restituisco il ticket
        return "Benvenuto! TICKET: ["+IDticket+"]";
      }
  //altrimenti dico all'utente che il parcheggio è pieno
  else return "Parcheggio Pieno"

  } catch (error) {
    console.error(error);
  }
}

//Gestisce la cassa per pagare il ticket
async function handlePayment(id_ticket) {
    try {
      //estraggo l'istanza del ticket nel database
      const rowData=await getRowTicketsByID(id_ticket);
      if(rowData===undefined){
        throw new Error("Il ticket non esiste");
      }

      let responsePayment={
        id_parking:rowData["IDparking"],
        result:null
      };

      //se il ticket è già pagato avviso l'utente
      if(rowData["Stato"]=="Pagato"){
        console.log("Ticket già pagato");
        responsePayment.result=`Ticket: [${id_ticket}] Gia' Pagato`
        return responsePayment
      }

      //setto lo stato del ticket su "Pagato" e mando il messaggio all'utente
      const sqlPayTicket="UPDATE Tickets SET Stato = ? WHERE IDticket = ?"
      db.run(sqlPayTicket,["Pagato",id_ticket],(err)=>{
        if(err){
          console.error(err)
          throw new Error(err.message)
        }
         console.log(`DATABASE: Ticket pagato`);
        })
        responsePayment.result=`Ticket: [${id_ticket}] ---> Pagato`
        return responsePayment
      
      } catch (error) {
        console.error(error);
      }
}

//Gestisce la sbarra di uscita
async function handleExit(id_ticket){
  try {
    //controllo se esiste un'istanza del ticket nel database
    const rowData=await getRowTicketsByID(id_ticket)
    if(rowData===undefined){
      throw new Error("Il ticket non esiste");
    }

    //estraggo l'id del parcheggio
    const IDparking=rowData["IDparking"]

    //preparo il messaggio
    let responseExit={
      id_parking:rowData["IDparking"],
      result:null
    };

    //se il ticket non è stato pagato rifiuto la richiesta di uscita
    if(rowData["Stato"]=="Non pagato"){
      responseExit.result="Il ticket non è stato pagato";
      return responseExit;
    }
    
    //se è stato pagato rimuovo il ticket da quelli del database
    const sqlDeleteTicket="DELETE FROM Tickets WHERE IDticket = ?";
    
    //aggiungi al database il nuovo ticket
    db.run(sqlDeleteTicket,[id_ticket],(err,row)=>{
      if (err) {
        console.error(err)
        throw new Error(err.message);
      }
      else console.log(`DATABASE: Ticket eliminato: [${id_ticket},${IDparking}]`);
    })

    //incremento di uno il numero di posti nel database
    let rowDataParking=await getRowParkingByID(IDparking);
    
    const spots=rowDataParking["Posti"];
    
    const sqlIncreaseSpots="UPDATE Parcheggi SET Posti = ? WHERE ID = ?";
    const newValueSpots=spots+1;

    //aggiorno il database
    db.run(sqlIncreaseSpots,[newValueSpots,IDparking], (err) => {
      if (err) {
          console.error(err)
          throw new Error(err.message);
      }
      else console.log("DATABASE: Posto incrementato");
    })

    responseExit.result="Ticket pagato. Arrivederci! :)";
    return responseExit;

  } catch (error) {
    console.error(error);
  }
}

//-------------------funzioni che agiscono sul database

//estrai una certa riga dalla tabella Parcheggi dato l'id
function getRowParkingByID(id_parking){
  const sql='SELECT * FROM Parcheggi WHERE ID = ?';
  return new Promise((resolve, reject) => {
    db.get(sql, [id_parking],(err, row) => {
      if (err) {
        console.error(err.message);
      } else {
        if (row) {
          resolve(row)
        } else {
          reject(`Nessun dato trovato con ID: ${id_parking}`);
        }
      }
    });
  })
}

//estrai la riga indicata dal ticket
function getRowTicketsByID(id_ticket){
  const sql='SELECT * FROM Tickets WHERE IDticket = ?';
  return new Promise((resolve, reject) => {
    db.get(sql, [id_ticket],(err, row) => {
      if (err) {
        console.error(err.message);
      } else {
        if (row) {
          resolve(row)
        } else {
          resolve();
        }
      }
    });
  })
}


if (isMainThread) {
  const entryWorker = new Worker('./mqtt-workers/entryWorker.js', { workerData: { topic: 'smartparking/entry/request' } });
  const paymentWorker = new Worker('./mqtt-workers/paymentWorker.js', { workerData: { topic: 'smartparking/payment/request' } });
  const exitWorker = new Worker('./mqtt-workers/exitWorker.js', { workerData: { topic: 'smartparking/exit/request' } });

//STRUTTURA MESSAGGIO DEL THREAD:
/*
    {
      purpose: scopo del messaggio,
      message: contenuto del messaggio da inviare
    }
**/

//STRUTTURA MESSAGGIO DA INVIARE AL THREAD:
/*
    {
      ID: id del parcheggio che deve ricevere la risposta,
      message: contenuto del messaggio da stampare
    }
**/

  // Aspetto un messaggio dal thread dedicato all'ingresso
  entryWorker.on('message', (data) => {
    //se lo scopo del messaggio inviato dal thread è per una comunicazione mqtt procedo
    if(data.purpose==="mqtt-entry"){
      // stampo per scopi di denug il messaggio ricevuto dal thread
      console.log('Messaggio da entryWorker:', data);
      //salvo l'id del parcheggio ricevuto dal thread 
      const id=data.message;
      //gestisco l'ingresso facendo controlli
      handleEntry(id)
      //se ricevo un esito positivo invio al thread dedicato l'id del parcheggio e il risultato dell'elaborazione
      .then(result=>{
          entryWorker.postMessage({IDParking:id, message:result})
      })
      .catch((error)=>console.error(error))
    }
    //altrimenti tratto i messaggi per debuggging da stampare su terminale
    else if(data.purpose=="debugging"){
      console.log('Messaggio da entryWorker:', data);
    }
  });

  // Aspetto un messaggio dal thread dedicato ai pagamenti
  paymentWorker.on('message', (data) => {
    //se lo scopo del messaggio inviato dal thread è per una comunicazione mqtt procedo
    if(data.purpose==="mqtt-payment"){
      // stampo per scopi di denug il messaggio ricevuto dal thread
      console.log('Messaggio da paymentWorker:', data);
      //salvo l'id del parcheggio ricevuto dal thread 
      const id=data.message;
      //gestisco l'ingresso facendo controlli
      handlePayment(id)
      .then((response)=>{
        paymentWorker.postMessage({IDParking:response.id_parking, message:response.result})
      })
      .catch((error)=>console.error(error))
    }
    //altrimenti tratto i messaggi per debuggging da stampare su terminale
    else if(data.purpose=="debugging"){
      console.log('Messaggio da paymentWorker:', data);
    }
  });

  // Aspetto un messaggio dal thread dedicato all'uscita
  exitWorker.on('message', (data) => {
    //se lo scopo del messaggio inviato dal thread è per una comunicazione mqtt procedo
    if(data.purpose==="mqtt-exit"){
      // stampo per scopi di denug il messaggio ricevuto dal thread
      console.log('Messaggio da exitWorker:', data);
      //salvo l'id del parcheggio ricevuto dal thread 
      const id=data.message;
      //gestisco l'ingresso facendo controlli
      handleExit(id)
      .then((response)=>{
        exitWorker.postMessage({IDParking:response.id_parking, message:response.result})
      })
      .catch((error)=>console.error(error))
    }
    //altrimenti tratto i messaggi per debuggging da stampare su terminale
    else if(data.purpose=="debugging"){
      console.log('Messaggio da exitWorker:', data);
    }
  });

}


