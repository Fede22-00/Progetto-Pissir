const fs = require('fs');
const path = require('path');


//funzione per generare una stringa pseudocasuale di n caratteri
function makeid(n) {
    let result = '';
    const characters = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
    const charactersLength = characters.length;
    let counter = 0;
    while (counter < n) {
      result += characters.charAt(Math.floor(Math.random() * charactersLength));
      counter += 1;
    }
    return result;
}

//funzione che legge un file presente in una certa cartella e lo manda in risposta
const readFile=function(filePath,contentType,res){
    fs.readFile(filePath, 'utf8', (err, data) => {
      if (err) {
          res.writeHead(500, { 'Content-Type': 'text/plain' });
          res.end('Errore interno del server');
      } else {
          res.writeHead(200, { 'Content-Type': contentType });
          res.end(data);
      }
  });
  }

  module.exports={makeid,readFile}