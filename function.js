const fs = require('fs');
const path = require('path');
const nodemailer = require('nodemailer');
const axios = require('axios');

const mondayApiKey = 'eyJhbGciOiJIUzI1NiJ9.eyJ0aWQiOjIzMjg3MzUyNCwiYWFpIjoxMSwidWlkIjoyMzUzNzM2NCwiaWFkIjoiMjAyMy0wMS0zMVQyMTowMjoxNy4wMDBaIiwicGVyIjoibWU6d3JpdGUiLCJhY3RpZCI6OTUwNzUxNiwicmduIjoidXNlMSJ9.lX1RYu90B2JcH0QxITaF8ymd4d6dBes0FJHPI1mzSRE';

// Configuración de Nodemailer con SMTP
const smtpTransport = nodemailer.createTransport({
    host: 'smtp.gmail.com',
    port: 587,
    secure: false,
    auth: {
        user: 'central@urbex.cl',
        pass: 'Urbexcentral1!'
    }
});

// Función para leer la plantilla del correo electrónico
function readEmailTemplate() {
    try {
        const filePath = path.join(__dirname, 'emailTemplate.html');
        return fs.readFileSync(filePath, 'utf8');
    } catch (error) {
        console.error('Error al leer la plantilla de correo electrónico:', error);
        throw error;
    }
}

// Función para enviar un correo electrónico personalizado
async function sendCustomEmail(to, subject, firstname, address, email) {
    try {
        let emailHtml = readEmailTemplate();
        emailHtml = emailHtml.replace('[Nombre]', firstname).replace('[Dirección]', address).replace('[Correo]', email);

        const mailOptions = {
            from: '"Urbex Central" <central@urbex.cl>',
            to: to,
            subject: subject,
            html: emailHtml
        };

        await smtpTransport.sendMail(mailOptions);
        console.log('Correo enviado con éxito a:', to);
    } catch (error) {
        console.error('Error al enviar correo electrónico:', error);
        throw error;
    }
}

// Function to get data from a Monday.com item
async function getMondayItemData(itemId) {
    const query = `
      query {
        items(ids: [${itemId}]) {
          column_values {
            id
            text
            value
          }
          subitems {
            column_values {
              id
              text
              value
            }
          }
        }
      }
    `;
  
    const response = await axios.post('https://api.monday.com/v2', { query }, {
      headers: {
        'Authorization': `Bearer ${mondayApiKey}`,
        'Content-Type': 'application/json'
      }
    });
  
    const itemData = response.data?.data?.items[0];

    // Verificar el tipo de contrato
    const contractType = itemData.column_values.find(cv => cv.id === 'estado_1')?.text;
    if (contractType !== 'Arriendo') {
        console.log('El tipo de contrato no es Arriendo. Función no ejecutada.');
        return null;
    }

    return itemData;
  }
  
  // Function to process subitems and create new items
  async function processSubElementsAndSendMessages(itemId) {
    try {
      const itemData = await getMondayItemData(itemId);

      if (!itemData) {
        console.error('No se encontraron datos para el item ID:', itemId);
        return;
      }
  
      console.log('Datos del item:', itemData);
  
      const address = itemData.column_values.find(cv => cv.id === 'ubicaci_n')?.text;
      console.log('Dirección:', address);
  
      if (!Array.isArray(itemData.subitems)) {
        console.error('No hay subelementos para procesar para el item con ID:', itemId);
        return;
      }
  
      for (const subitem of itemData.subitems) {
        const subitemColumns = subitem.column_values;
        console.log('Subitem column values:', JSON.stringify(subitemColumns, null, 2));
  
        const firstname = subitemColumns.find(column => column.id === 'reflejo0')?.text || '';
        const lastName = subitemColumns.find(column => column.id === 'reflejo')?.text || '';
        const email = subitemColumns.find(column => column.id === 'reflejo_3')?.text || '';
        const fullName = `${firstname} ${lastName}`;
  
        // Send email
        await sendCustomEmail(email, `🖊️ Hola ${firstname}, ¡Tu contrato está disponible para firmar!`, firstname, address, email);
      }
  
      console.log('Procesamiento completado para el elemento:', itemId);
    } catch (error) {
      console.error('Error al procesar subelementos y crear nuevos elementos:', error);
      throw error;
    }
  }
  
  // Function to handle the Google Cloud webhook
  exports.mailFirmaDisponible = async (req, res) => {
      try {
        const itemId = req.body.event.pulseId;
        console.log('Webhook activado para item ID:', itemId);
        await processSubElementsAndSendMessages(itemId);
        res.status(200).send('Mensajes enviados');
      } catch (error) {
        console.error('Error en webhook:', error);
        res.status(500).send('Error al procesar el webhook');
      }
    }