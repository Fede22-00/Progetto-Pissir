class Parking{

    constructor(element){
        this.id=element["ID"];
        this.zone=element["Zona"];
        this.spots=element["Posti"];
        this.status=element["Stato"];
    }
}
const urlRoot="https://localhost:8443"
const table=document.getElementById('parkingsTable');

let parkings=[];

const logout_button=document.getElementById("home-button");
logout_button.addEventListener('click',function(){
  window.location.href = '/';
})

//scarica tutti i parcheggi esistenti e li mostra, inoltre è possibile modificare lo stato di ogni parcheggio semplicemente cliccando
fetch(urlRoot+'/getAllParkings')
  .then(response =>{ 
    if (!response.ok) {
        throw new Error('Errore nella richiesta, forse pagina non esistente?');
      }
      return response.json(); // Parsa il file JSON
    })
  .then(data => {
    
    let dataTable='';
    parkings = data.map((el) => new Parking(el));
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
      const colorButton=(el.status==0)?"btn-success" : (el.status==1)? "btn-danger" : "btn-warning";
        dataTable+=`<tr>
        <td>
          <button name="removeParkingButton" value="${el.id}" type="button" class="btn btn-light btn-remove">
            <i class="bi bi-trash-fill"></i>
          </button>
        </td>
        <td>
            ${el.id}
        </td>
        <td>
            ${el.zone}
        </td>
        <td>
            ${el.spots}
        </td>
        <td>
            <button name="changeStatusParkingButton" value="${el.id}:${el.status}" type="button" class="btn btn-status ${colorButton}">
                ${(el.status==0)?"Aperto" : "Chiuso"}
            </button>
        </td>
        </tr>`;
    });

    table.innerHTML=dataTable;

  }).then(()=>{

    //----OGNI RIGA HA UN PULSANTE PER ELIMINARE IL PARCHEGGIO CORRISPONDENTE
    var deleteButtons = document.getElementsByName('removeParkingButton');
    deleteButtons.forEach(function(button) {
      button.addEventListener('click',function(){
        
         // Opzioni per la richiesta DELETE
         const options = {
          method: 'DELETE', // Specifica il metodo HTTP
          headers: {
            'Content-Type': 'application/json' // Specifica il tipo di dati inviati (JSON in questo caso)
          },
          //invio il body composto da "ID"
          body: JSON.stringify(button.value) // Converte l'oggetto JavaScript in una stringa JSON
        };

        //eseguo una richiesta DELETE per modificare il valore del parcheggio
        fetch(urlRoot+'/admin/removeParking',options)
          .then(response=>{
            if (!response.ok) {
            throw new Error('Errore per la DELETE del parcheggio, forse pagina non esistente?');
          }
          return response.json(); // Parsa il file JSON
        }).then(()=>{
          window.location.reload()
        })
      })
    })

    //----OGNI RIGA HA UN PULSANTE PER CAMBIARE LO STATO DEL PARCHEGGIO
    var statusButtons = document.getElementsByName('changeStatusParkingButton');
    // aggiunge un event listener per ogni elemento button che indica lo stato corrente del parcheggio
    statusButtons.forEach(function(button) {
      button.addEventListener('click', function() {
        
        console.log(button.value);

        // Opzioni per la richiesta PUT
        const options = {
          method: 'PUT', // Specifica il metodo HTTP
          headers: {
            'Content-Type': 'application/json' // Specifica il tipo di dati inviati (JSON in questo caso)
          },
          //invio il body composto da "ID:valore"
          body: JSON.stringify(button.value) // Converte l'oggetto JavaScript in una stringa JSON
        };

        //eseguo una richiesta PUT per modificare il valore del parcheggio
        fetch(urlRoot+'/admin/changeStatusParking',options)
          .then(response=>{
            if (!response.ok) {
            throw new Error('Errore per la PUT del cambio parcheggio, forse pagina non esistente?');
          }
          return response.json(); // Parsa il file JSON
        }).then(()=>{
          window.location.reload()
        })

      });
    });
  })
  .catch(error => {
    console.error('Si è verificato un errore nella richiesta:', error);
  });

const addParkingForm=document.getElementById('addNewParkingForm');

// Gestisci l'evento di invio del form
  addParkingForm.addEventListener('submit', function(event) {
    event.preventDefault()
    // Accedi ai valori dei campi di input
    //prendo il nome della zona per il nuovo parcheggio
    const zoneNewParking = document.getElementById('zoneNewParking').value;
    //prendo la quantità disponibile di posti
    let spotsNewParking = document.getElementById('spotsNewParking').value;
    if(zoneNewParking==='')return;
    else if(spotsNewParking==='') spotsNewParking='1'
      // Opzioni per la richiesta POST
      const options = {
        method: 'POST', // Specifica il metodo HTTP
        headers: {
          'Content-Type': 'application/json' // Specifica il tipo di dati inviati (JSON in questo caso)
        },
        //invio il body composto da numero nuovo del parcheggio in quella zona e il nome della zona scelta
        body: JSON.stringify({"spots":spotsNewParking, "zone":zoneNewParking}) // Converte l'oggetto JavaScript in una stringa JSON
      };

    fetch(urlRoot+'/admin/addNewParking',options)
      .then(response=>{
        if (!response.ok) {
        throw new Error('Errore per la POST del nuovo parcheggio, forse pagina non esistente?');
      }
      return response.json(); // Parsa il file JSON
    }).then(()=>{
      window.location.reload()
    })


  });

 


  