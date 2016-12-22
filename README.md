#Raspberry Pi - Cam2Dropbox
A simple app that can take photos with a Raspberry Pi camera module and send them to Dropbox using your API key.

##Requirements
* Node >= v4.x.x

##Usage
* Clone the repo to your pi: `git clone https://github.com/barneydmedia/rpi_cam2dropbox.git`
* `cd rpi_cam2dropbox`
* install dependencies `npm install`
* `node index.js YOUR_DROPBOX_API_KEY`

##Folder Structures
Each time the script starts, it will try to create a top level folder in your Dropbox and your user folder. It will then create a dated child folder in each, where date/time stamped jpegs will be saved. The folder structure should look like `~/rpi_cam2dropbox/2016-12-19/2016-12-19T22.28.01Z.jpg`.