class Parking{

    constructor(element){
        this.zone=element["Zona"];
        this.number=element["Posti"];
        this.status=(element["Stato"]==0)?"Aperto" : "Chiuso";
    }
}

const urlRoot="https://localhost:8443"
const table=document.getElementById('parkingsTable');

fetch(urlRoot+'/getAllParkings')
  .then(response =>{ 
    if (!response.ok) {
        throw new Error('Errore nella richiesta, forse pagina non esistente?');
      }
      return response.json(); // Parsa il file JSON
    })
  .then(data => {
    
    let dataTable='';
    let parkings = data.map((el) => new Parking(el));
    //ordino i parcheggi in ordine alfabetico crescente in base al nome della zona
    parkings.sort((a, b) => {
        const zonaA = a.zone.toUpperCase(); // Converte in maiuscolo per l'ordinamento senza distinzione tra maiuscole e minuscole
        const zonaB = b.zone.toUpperCase();
    
        if (zonaA < zonaB) {
            return -1;
        }
        if (zonaA > zonaB) {
            return 1;
        }
        return 0;
    });

    //Zona
    //Numero
    //Stato
    //preparo la stringa da aggiungere nel file html per mostrare i parcheggi
    parkings.forEach(el => {
        dataTable+="<tr>"
        +`<td>${el.zone}</td>`
        +`<td>${el.number}</td>`
        +`<td>${el.status}</td>`
        +"</tr>";
    });
    table.innerHTML=dataTable;
    
  })
  .catch(error => {
    console.error('Si è verificato un errore nella richiesta:', error);
  });