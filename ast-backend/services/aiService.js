const axios = require('axios');

// الرابط المباشر والكامل للخدمة
const AI_PREDICT_URL =
    'https://smart-asset-ai-production.up.railway.app/api/v1/predict';

async function getAssetPrediction(payload) {
    try {
        console.log(
            '--- Sending Payload to AI ---',
            JSON.stringify(payload, null, 2),
        );

        const response = await axios({
            method: 'post',
            url: AI_PREDICT_URL,
            data: payload,
            headers: {
                'Content-Type': 'application/json',
                Accept: 'application/json',
            },
            timeout: 15000,
        });

        console.log('--- AI Response ---', response.data);
        return response.data;
    } catch (error) {
        const errorDetails = error.response?.data || error.message;
        console.error(
            'Error contacting AI service:',
            JSON.stringify(errorDetails, null, 2),
        );

        throw new Error(
            typeof errorDetails === 'object'
                ? JSON.stringify(errorDetails)
                : errorDetails,
        );
    }
}

module.exports = {
    getAssetPrediction,
};
