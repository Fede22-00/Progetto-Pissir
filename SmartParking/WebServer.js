'use strict';

//librerie importate
const https = require('https');
const fs = require('fs');
const path = require('path');
const db = require('./db');
const url= require('url');
const querystring = require('querystring');
const support=require('./supportFunctions');
const {google} = require('googleapis');
const mqtt = require('mqtt');


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
// Configurazione del client MQTT
const brokerURL='mqtts://test.mosquitto.org:8883'
const client = mqtt.connect(brokerURL, {
  ca: [fs.readFileSync('ssl/secure-broker/mosquitto.org.crt')], // Percorso al tuo certificato CA
  rejectUnauthorized: true, // Impedisce connessioni non autorizzate
});

const topics=['smartparking/entry/request','smartparking/payment/request','smartparking/exit/request']

//====================
//|Eventi CLIENT MQTT|
//============================================================================
//connette il client al broker
client.on('connect', () => {
  console.log(`Connesso al broker MQTT su TLS/SSL: ${brokerURL}`);

  // Sottoscrizione a tutti i topic nell'array
  client.subscribe(topics, (err, granted) => {
    if (!err) {
      //stampa tutti i percorsi a cui il server sottoscrive
      console.log('Sottoscrizione avvenuta con successo ai seguenti topic:');
      granted.forEach((grant) => {
        console.log(`  - ${grant.topic}`);
      });
    } else {
      console.error('Errore durante la sottoscrizione:', err);
    }
  });
});

//il server rimane in ascolto per i messaggi dell'utente
client.on('message',(topic, message) => {
  console.log(`Messaggio ricevuto su ${topic}: ${message.toString()}`);

  //smartparking/entry/request
  //in questo caso ID è quello del parcheggio
  if(topic==='smartparking/entry/request'){
    const IDparking=message.toString();
    handleEntry(IDparking).then((response)=>{
      sendResponse(IDparking,"entry",response);
    })
  }
   //smartparking/payment/request
  else if(topic==='smartparking/payment/request'){
    const IDticket=message.toString();
    handlePayment(IDticket).then((response)=>{
      sendResponse(response.id_parking,"payment",response.result);
    })
  }
  //smartparking/exit/request
  else if(topic==='smartparking/exit/request'){
    const IDticket=message.toString();
    handleExit(IDticket).then((response)=>{
      sendResponse(response.id_parking,"exit",response.result);
    }).catch((error)=>{
      console.error(error);
    });
  }
});

client.on('error', (err) => {
  console.error('Errore di connessione MQTT:', err);
});

client.on('close', () => {
  console.log('Connessione MQTT chiusa');
});

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

//==================================
//|Gestore funzionamento dei device|
//============================================================================

//Gestisce la sbarra di ingresso
async function handleEntry(id_parking) {
  //Estraggo i numeri del parcheggio
  let responseEntry;

  try {
    let rowData=await getRowParkingByID(id_parking);
    
    //prima controllo se il parcheggio è chiuso o aperto
    if(rowData["Stato"]==1)return "Parcheggio chiuso, non puoi entrare"

    const spots=rowData["Posti"];
  
  //se il numero non è 0 allora:

  //1 - genero un ticket per l'utente e lo metto nella tabella "Tickets"
            //{IDticket , IDparking}

  //2 - decremento i posti sul database alla tabella "Parcheggi"

  //3 - salvo il ticket nella variabile response, sovrascrivendola

  //se il numero è 0 allora verrà inviato "Parcheggio pieno"
  if(spots>0){
    //--------------------------------------------------------------------1
    const IDticket=support.makeid(20);
    const sqlInsertNewTicket="INSERT INTO Tickets (IDticket,IDparking) VALUES (?,?)";
    
    //aggiungi al database il nuovo ticket
    db.run(sqlInsertNewTicket,[IDticket,id_parking],(err,row)=>{
      if (err) {
        return console.error(err.message);
      }
      console.log(`DATABASE: Nuovo ticket inserito: [${IDticket},${id_parking}]`);
    })
    //--------------------------------------------------------------------2
    const sqlDecreaseSpots="UPDATE Parcheggi SET Posti = ? WHERE ID = ?";
    const newValueSpots=spots-1;

    //aggiorno il database
    db.run(sqlDecreaseSpots,[newValueSpots,id_parking], (err) => {
      if (err) {
          console.error(err)
        return;
      }
          console.log("DATABASE: Posto decrementato");
    })
    responseEntry="Benvenuto! TICKET: ["+IDticket+"]";
  }
  else responseEntry="Parcheggio Pieno"

  } catch (error) {
    console.log("errore");
  }
  return responseEntry;
}

//Gestisce la cassa per pagare il ticket
async function handlePayment(id_ticket) {
    try {
      //estraggo l'istanza del ticket nel database
      const rowData=await getRowTicketsByID(id_ticket);
      if(rowData===undefined){
        console.log("il ticket non esiste")
        return;
      }

      let responsePayment={
        id_parking:rowData["IDparking"],
        result:null
      };

      //se il ticket è già pagato avviso l'utente
      if(rowData["Stato"]=="Pagato"){
        console.log("ticket già pagato");
        responsePayment.result=`Ticket: [${id_ticket}] Gia' Pagato`
        return responsePayment
      }

      //setto lo stato del ticket su "Pagato" e mando il messaggio all'utente
      const sqlPayTicket="UPDATE Tickets SET Stato = ? WHERE IDticket = ?"
      db.run(sqlPayTicket,["Pagato",id_ticket],(err)=>{
        if(err){
          console.error(err)
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
    const rowData=await getRowTicketsByID(id_ticket)
    const IDparking=rowData["IDparking"]

    let responseExit={
      id_parking:rowData["IDparking"],
      result:null
    };

    if(rowData["Stato"]=="Non pagato"){
      responseExit.result="Il ticket non è stato pagato";
      return responseExit;
    }
    
    //--------------------------------------------------------------------1
    const sqlDeleteTicket="DELETE FROM Tickets WHERE IDticket = ?";
    
    //aggiungi al database il nuovo ticket
    db.run(sqlDeleteTicket,[id_ticket],(err,row)=>{
      if (err) {
        return console.error(err.message);
      }
      console.log(`DATABASE: Ticket eliminato: [${id_ticket},${IDparking}]`);
    })

    //--------------------------------------------------------------------2
    let rowDataParking=await getRowParkingByID(IDparking);
    
    const spots=rowDataParking["Posti"];
    
    const sqlIncreaseSpots="UPDATE Parcheggi SET Posti = ? WHERE ID = ?";
    const newValueSpots=spots+1;

    //aggiorno il database
    db.run(sqlIncreaseSpots,[newValueSpots,IDparking], (err) => {
      if (err) {
          console.error(err)
        return;
      }
          console.log("DATABASE: Posto incrementato");
    })

    responseExit.result="Ticket pagato. Arrivederci! :)";
    return responseExit;

  } catch (error) {
    console.error(error);
  }
}




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



