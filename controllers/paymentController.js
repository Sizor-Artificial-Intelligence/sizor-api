const axios = require("axios");
const ENV = process.env.NODE_ENV;


// Obtener Authorization de Bold
function getAuthorizationBold(tenantId = null) {
  const TENANTS_DEMO = ["sizor-0001", "sizor-0002"]; // TODO: Poner en DB o en variables de entorno

  // Está en modo desarrollo
  if (ENV === "development") {
    return process.env.AUTHORIZATION_BOLD_DEV;
  }
  
  // Es un tenant de demo
  if (tenantId && TENANTS_DEMO.includes(tenantId)) {
    return process.env.AUTHORIZATION_BOLD_DEV;
  }

  // Es un tenant de producción
  return process.env.AUTHORIZATION_BOLD;
}

// Obtener métodos de pago
async function getPaymentMethods(req, res) {
  try {
    let config = {
      method: "get",
      maxBodyLength: Infinity,
      url: `${process.env.URL_API_BOLD}/payment_methods`,
      headers: {
        Authorization:
          getAuthorizationBold(),
      },
    };
    const response = await axios.request(config);
    let data = response?.data?.payload?.payment_methods || {};
    data = Object.keys(data)?.map((key) => {
      return {
        name: key,
        ...data[key],
      };
    });
    res.json({
      status: "success",
      data,
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({
      error: error?.message || "Error desconocido",
    });
  }
}

// Crear un enlace de pago
async function createPaymentLink(req, res) {
  try {
    const data = req.body;
    const url_response = `https://${process.env.DOMAIN}/app`;
    const amount = parseFloat(data?.amount);
    const tenantId = data?.tenantId;
    const reference = data?.reference || `${tenantId}_${Date.now()}`;
    let description = data?.description || `Sizor AI`;

    if (!url_response || !amount || !tenantId) {
      return res
        .status(400)
        .json({ error: "Faltan parámetros en la solicitud" });
    }
    let config = {
      method: "post",
      maxBodyLength: Infinity,
      url: process.env.URL_API_BOLD,
      headers: {
        Authorization:
          getAuthorizationBold(tenantId),
      },
      data: {
        amount_type: "CLOSE",
        amount: {
          currency: "USD",
          tip_amount: 0,
          total_amount: amount,
        },
        description,
        payment_methods: ["CREDIT_CARD"],
        reference,
        image_url: process.env.BOLD_URL_IMAGE_APP,
        callback_url: url_response,
      },
    };

    const response = await axios.request(config);

    res.json({
      status: "success",
      data: {
        url: response?.data?.payload?.url,
        link_id: response?.data?.payload?.payment_link,
      },
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({
      error: error?.message || "Error desconocido",
      error_data: error?.response?.data || {},
    });
  }
}

// Obtener el estado de la transacción
async function getTransactionStatus(req, res) {
  try {
    const link_id = req.params.link_id;

    if (!link_id) {
      return res
        .status(400)
        .json({ error: "Faltan parámetros en la solicitud" });
    }

    let config = {
      method: "get",
      maxBodyLength: Infinity,
      url: `${process.env.URL_API_BOLD}/${link_id}`,
      headers: {
        Authorization:
          getAuthorizationBold(),
      },
    };

    const response = await axios.request(config);
    let data = response?.data;

    res.json({
      status: "success",
      data: {
        status: data?.status,
        is_sandbox: data?.is_sandbox,
        id: data?.id,
        transaction_id: data?.transaction_id,
      },
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({
      error: error?.message || "Error desconocido",
    });
  }
}

module.exports = {
  getPaymentMethods,
  createPaymentLink,
  getTransactionStatus,
};
