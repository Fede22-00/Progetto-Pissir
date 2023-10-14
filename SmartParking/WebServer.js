'use strict';

//librerie importate
const https = require('https');
const fs = require('fs');
const path = require('path');
const url= require('url');
const db = require('./db');
const querystring = require('querystring');
const support=require('./supportFunctions');
const {google} = require('googleapis');
const mqtt = require('mqtt');
const { Worker, isMainThread, parentPort, workerData } = require('worker_threads');


//=================================================================================================|
//==================================== [WEB API REST] =============================================|
//=================================================================================================|
//-------------------------------------OAUTH 2.0
/**
 * To use OAuth2 authentication, we need access to a CLIENT_ID, CLIENT_SECRET, AND REDIRECT_URI
 * from the client_secret.json file. To get these credentials for your application, visit
 * https://console.cloud.google.com/apis/credentials.
 */
const client_datas={
  "client_id":"935915899578-sj5avm190f533igj9rbf2f5sp8n7aeul.apps.googleusercontent.com",
  "client_secret":"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",
  "redirect_uris":["https://localhost:8443/auth/google/callback"]
}

const oauth2Client = new google.auth.OAuth2(
  client_datas.client_id,
  client_datas.client_secret,
  client_datas.redirect_uris[0]
);

// Access scopes for read-only Drive activity.
const scopes = [
  'https://www.googleapis.com/auth/userinfo.email',
];

// Generate a url that asks permissions for the Drive activity scope
const authorizationUrl = oauth2Client.generateAuthUrl({
  /** Pass in the scopes array defined above.
    * Alternatively, if only one scope is needed, you can pass a scope URL as a string */
  scope: scopes,
  // Enable incremental authorization. Recommended as a best practice.
  include_granted_scopes: true
});


var options = {
    key: fs.readFileSync('./ssl/https-web/server.key'),
    cert: fs.readFileSync('./ssl/https-web/server.crt')
  };

  let nameFile;
  let contentType;
  let filePath;
  let isAdmin=false;
const server = https.createServer(options,async (req, res) => {
    //------------------PAGINA INIZIALE------------------
    const { pathname, query } = url.parse(req.url);
    const params = querystring.parse(query);
    //console.log("--------------")
    console.log("pathname -> "+pathname);
    //console.log("query -> "+query);
    //console.log("params -> "+JSON.stringify(params));
    //console.log("--------------")
    
    // GET homepage
    if (req.method === 'GET' && pathname === '/') {
        nameFile='root';
        filePath = path.join(__dirname, 'public/views', `${nameFile}.html`);
        contentType = 'text/html'
        support.readFile(filePath,contentType,res);
    }

    //GET AUTORIZZAZIONE Google OAUTH2
    else if(req.method === 'GET' && pathname==='/auth/google'){
      res.writeHead(301, { "Location": authorizationUrl });
      res.end();
    }

    //GET Callback autorizzazione
    else if(req.method === 'GET' && pathname==='/auth/google/callback'){
      // Handle the OAuth 2.0 server response
      let q = url.parse(req.url,true).query;

      if(q.error){
        res.end("Accesso non autorizzato");
      }else{
        // Get access and refresh tokens (if access_type is offline)
        oauth2Client.getToken(q.code).then((tokens)=>{
          oauth2Client.setCredentials(tokens);
          console.log(oauth2Client.credentials);
          res.writeHead(301,{'Location':`https://localhost:8443/admin?code=true`})
          res.end()
        })
        
      }

    }

    //---------------------------------------------------------AREA AMMINISTRATORE
    // GET Pagina amministratore
    else if (req.method === 'GET' && pathname === '/admin') {
      if(params.code==="true"){
          nameFile='admin';
          filePath = path.join(__dirname, 'public/views', `${nameFile}.html`);
          contentType = 'text/html'
          support.readFile(filePath,contentType,res);
      }
     else{
        res.writeHead(301,{"Location":"/auth/google"})
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
    //---------------------------------------------------------

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

    //---------------------------------------------------------AREA AMMINISTRATORE
    // GET Pagina Utente
    else if (req.method === 'GET' && pathname === '/user') {
        nameFile='user';
        filePath = path.join(__dirname, 'public/views', `${nameFile}.html`);
        contentType = 'text/html'
        support.readFile(filePath,contentType,res);
    }

    //---------------------------------------------------------AREA UTENTE
   

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

//--------------------HTTPS

// Avvio del server su una porta unica
const port = 8443;
server.listen(port, () => {
  console.log(`Server in ascolto sulla porta ${port}`);
});


//=================================================================================================|
//========================================== [MQTT] ===============================================|
//=================================================================================================|

/*

//INVIA RISPOSTA SU MQTT
function sendResponse(id_parking,device,response){
  //invio la response all'utente al topic "smartparking/{ID_PARKING}/entry/response"
    const topic = `smartparking/${id_parking}/${device}/response`;
    const message = response;
    client.publish(topic, message, (err) => {
      if (!err) {
        console.log(`Messaggio pubblicato con successo su ${topic}: ${message}`);
      } else {
        console.error('Errore durante la pubblicazione del messaggio:', err);
      }
    });
}
*/
//==================================
//|Gestore funzionamento dei device|
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


