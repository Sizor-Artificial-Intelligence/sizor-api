const queueRoutes = require("./queue");
const paymentRoutes = require("./payment");
const realtimeRoutes = require("./realtime");
const iaRoutes = require("./ia");
const databaseRoutes = require("./database");

module.exports = (app) => {
  app.use("/queue", queueRoutes);
  app.use("/payment", paymentRoutes);
  app.use("/realtime", realtimeRoutes);
  app.use("/ia", iaRoutes);
  app.use("/database", databaseRoutes);
};
