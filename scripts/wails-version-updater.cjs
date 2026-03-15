const fs = require('fs');

module.exports.readVersion = function (contents) {
  const data = JSON.parse(contents);
  return data.info ? data.info.productVersion : '0.0.0';
};

module.exports.writeVersion = function (contents, version) {
  const data = JSON.parse(contents);
  if (!data.info) {
    data.info = {};
  }
  data.info.productVersion = version;
  return JSON.stringify(data, null, 2);
};
