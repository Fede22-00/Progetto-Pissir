// mqttWorker.js

//STRUTTURA MESSAGGIO DA INVIARE AL THREAD PRINCIPALE:
/*
    {
      purpose: scopo del messaggio,
      message: contenuto del messaggio da inviare
    }
**/

//STRUTTURA MESSAGGIO RICEVUTO DAL THREAD PRINCIPALE
/*
    {
      ID: id del parcheggio che deve ricevere la risposta,
      message: contenuto del messaggio da stampare
    }
**/

const { parentPort } = require('worker_threads');
const mqtt = require('mqtt');
const fs = require('fs');

// Configura la connessione MQTT
const client = mqtt.connect('mqtts://test.mosquitto.org:8883', {
  ca: [fs.readFileSync('ssl/secure-broker/mosquitto.org.crt')],
  rejectUnauthorized: true,
});

client.subscribe('smartparking/payment/request');

// Gestisci i messaggi MQTT
// Gestisci i messaggi MQTT ricevuti dal topic
client.on('message', (topic, message) => {
    //ricevo il messaggio via mqtt e lo inoltro al thread pricipale per elaborarlo
    const id_parking = `${message.toString()}`;
    parentPort.postMessage({purpose:"mqtt-payment",message:id_parking});
  });
  
  //ricevo i dati elaborati dal thread principale

  parentPort.on('message',((data)=>{
      //salvo l'id del parcheggio e il risultato dell'elaborazione
      const id_parking=data.IDParking;
      const response=data.message;
      //creo il topic di risposta in base all'id del parcheggio
      const topic = `smartparking/${id_parking}/payment/response`;
  
      //se l'id e il messaggio non sono Undefined invio la risposta al topic
      if((response!=undefined) && (id_parking!=undefined)){
      client.publish(topic, response, (err) => {
          if (!err) {
              parentPort.postMessage({purpose:"debugging",message:`Messaggio pubblicato con successo su ${topic}: ${response}`});
          } else {
            console.error('Errore durante la pubblicazione del messaggio:', err);
          }
        });
      }else parentPort.postMessage({purpose:"debugging",message:`Errore nei dati ricevuti: ${data.IDParking} ${data.message}`});
      
  }))