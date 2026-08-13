module.exports = {
  forbidden: [
    {
      name: "no-circular",
      severity: "error",
      comment: "Modules do not depend on each other in a cycle",
      from: {},
      to: { circular: true },
    },
  ],
  options: {
    doNotFollow: { path: "node_modules" },
  },
};
