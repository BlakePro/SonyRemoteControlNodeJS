const express = require('express');
const bodyParser = require('body-parser');
const cors = require('cors');
const helmet = require('helmet');
const fs = require('fs');
const axios = require('axios');
const arp = require('@network-utils/arp-lookup');
const path = require('path');
const minify = require('html-minifier').minify;

const psk_auth = '0000';
const port = 8338;
const white_list = ['Hon Hai Precision Ind. Co, Ltd'];
const dir_tv = path.join(__dirname + '/tv/');
const file_app = path.join(__dirname + '/index.html');
const app = express();

app.use(cors());
app.use(bodyParser.urlencoded({extended: true}));
app.use(helmet());
app.use(express.static(__dirname + '/static'));

const https = require('http').createServer(app).listen(port, () => {console.log('HTTP ON LOCALHOST PORT: ' + port)});

app.get('/', (req, res) => {
  tv_control_list();
  var to_send = '<br><div class="container"><div class="row"><div class="col-12 text-center"><h2>Remote Control</h2></div></div><br><div class="row">';
  fs.readdirSync(dir_tv).forEach(file => {
    if(file.includes(".json")){
      var ip = file.replace('.json', '');
      to_send += '<div class="col-6 text-center"><button class="link" data-action="' + ip + '" data-send="tv"><i data-feather="tv"></i></button><br>' + ip + '</div>';
    }
  });
  to_send += '</div></div>';
  var html = fs.readFileSync(file_app, 'utf8');
  html = minify(html.replace('{code}', to_send), {
    collapseInlineTagWhitespace: true,
    collapseWhitespace: true,
    removeTagWhitespace: true,
    minifyJS: true,
    minifyCSS: true,
    removeComments: true
  });
  res.send(html);
});

app.get('/tv/:ip/', async (req, res) => {
  var ip = req.params.ip;
  var controls = JSON.parse(fs.readFileSync(dir_tv + ip + '.json'));
  var to_send = '<input type="hidden" value="' + ip + '" id="ip">';
  if(typeof controls === 'object'){
    for(no in controls){
      var control = controls[no];
      var name = (control.name).toLowerCase();
      var value = control.value;
      //console.log(name + " --> " + value);
      to_send += '<input type="hidden" value="' + value + '" id="' + name + '" class="control_replace">';
    }
  }
  res.send(to_send);
});

app.get('/control/:ip/:control', async (req, res) => {
  var control = req.params.control;
  var ip = req.params.ip;
  var url = 'http://' + ip + '/sony/IRCC';
  var xml = '<?xml version=\"1.0\"?><s:Envelope xmlns:s=\"http://schemas.xmlsoap.org/soap/envelope/\" s:encodingStyle=\"http://schemas.xmlsoap.org/soap/encoding/\"><s:Body><u:X_SendIRCC xmlns:u=\"urn:schemas-sony-com:service:IRCC:1\"><IRCCCode>' + control + '</IRCCCode></u:X_SendIRCC></s:Body></s:Envelope>';
  var header = {
    headers: {
      'Content-Type': 'text/xml; charset=UTF-8',
      'X-Auth-PSK' : psk_auth,
      'SOAPACTION': '"urn:schemas-sony-com:service:IRCC:1#X_SendIRCC"'
    }
  }
  await axios.post(url, xml, header)
  .then((response) => {/*console.log(response.status)*/})
  .catch((error) => {});

  res.send(control);
});

const tv_control_list = async () => {
  await arp.getTable().then(table => {
    table.forEach(data => {
      var vendor = data.vendor;
      var ip = data.ip;
      var mac = data.mac;
      if(!white_list.indexOf(vendor)){
        var json_file = dir_tv + ip + '.json';
        if(!fs.existsSync(json_file)){
          var server = 'http://' + ip + '/sony/system';
           axios.post(server, {
            method: 'getRemoteControllerInfo',
            params: [],
            id: 10,
            version: "1.0"
          })
          .then((response) => {
            if(typeof response.data.result[1] !== 'undefined'){
              var controls = JSON.stringify(response.data.result[1]);
              fs.writeFileSync(json_file, controls);
            }
          })
          .catch((error) => {});
        }
      }
    });
  });
};
