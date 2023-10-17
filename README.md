# SmartParking

    					Preparazione:

1.  Andare alla directory `SmartParking`

2.  Eseguire il comando `npm install` per installare le dipendenze in package.json

3.  Avvia il server con `node WebServer.js`

4.  Avviare il server di autenticazione in TLS:

    Eseguire il seguente comando nella cartella contenente il software di KeyCloak:

    #### Per Linux:

        `bin/kc.sh start-dev --https-certificate-file=server-cert.pem --https-certificate-key-file=server-key.pem --https-port=8500`

    #### Per Windows:

        `bin/kc.sh start-dev --https-certificate-file=server-cert.pem --https-certificate-key-file=server-key.pem --https-port=8500`

### Avviso riguardo a Keycloak

A causa di un bug presente nell'ultima versione di Keycloak (versione 22.0.3), in certe cartelle non viene eseguito il software per avviare il server di autenticazione
(ClassNotFoundException).

Si consiglia quindi di eseguire keycloak da una cartella differente, ad esempio dal Desktop
