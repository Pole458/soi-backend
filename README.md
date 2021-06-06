# Installation

## Front End

Open a terminal and type the following commands:

`cd /var/www`

`git clone https://github.com/Pole458/soi-frontend.git`

`sudo cp soi-frontend/datahub.conf /etc/apache2/sites-available`

`sudo a2ensite datahub.conf`

`sudo systemctl reload apache2`

Now you can try visiting the page www.datahub to see if everything is working.

## Back End

Open a terminal and type the following commands:

`cd some/directory`

`git clone https://github.com/Pole458/soi-backend.git`

`cd soi-backend`

`npm install`

To run the server, type:

`node src/server.js`
