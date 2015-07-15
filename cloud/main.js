// Use Parse.Cloud.define to define as many cloud functions as you want.
// For example:

//Call Cloud functions with:
//https://9uH7wnXCApdzv4vtL38fN8w1F8YpWXzzqhx9ITtp:javascript-key%3DTi6naCnm6CVBjo5iAjljsV8ByduSBWnj2OSCF8ZL@api.parse.com/1/functions/ANY_FUNCTION

//Make user a wallet.
Parse.Cloud.afterSave("_User", function(request) {
  if (!request.object.existed()) {
    Parse.Cloud.useMasterKey();
    var user = request.object;
    user.set("balance", parseInt(0));
    user.save();
    //{"destination":"15qx9ug952GWGTNn7Uiv6vode4RcGrRemh","callback_url": "https://my.domain.com/callbacks/new-pay","token":"YOURTOKEN"}
    var paymentForwardJson = {
      'destination' : '2N2WUqQi3uAuFumfZynXSMozHDnCwCdvy7x',
      'callback_url' : 'https://9uH7wnXCApdzv4vtL38fN8w1F8YpWXzzqhx9ITtp:javascript-key%3DTi6naCnm6CVBjo5iAjljsV8ByduSBWnj2OSCF8ZL@api.parse.com/1/functions/payment_received',
      'token' : 'ba0c10cde294f1540ad5dbae854df7f9'
    };
    var paymentForwardJsonString = JSON.stringify(paymentForwardJson);

    Parse.Cloud.httpRequest({
      url: 'http://api.blockcypher.com/v1/btc/test3/payments',
      method: 'POST',
      body: paymentForwardJsonString,
      success: function (httpResponse) {
        console.log('json: ' + httpResponse.text);
        var paymentForwardData = JSON.parse(httpResponse.text);

        var PaymentForwardClass = Parse.Object.extend("PaymentForward");
        var paymentForward = new PaymentForwardClass();

        var forwardId = paymentForwardData["id"];
        paymentForward.set("inputAddress", paymentForwardData.input_address);
        paymentForward.set("destination", paymentForwardData.destination);
        paymentForward.set("forwardId", forwardId);
        paymentForward.set("token", paymentForwardData.token);
        paymentForward.set("user", request.object);
        paymentForward.save();

        console.log('payment forward created with input address: '+ paymentForwardData.input_address);
      },
      error: function (httpResponse) {
        console.error('error creating payment forward: ' + httpResponse);
      }
    });
  }
});

Parse.Cloud.define("payment_received", function(request, response) {
    var paymentData = request.params;
    console.log('payment being forwarded with value: ' + paymentData["value"]);

    var PaymentClass = Parse.Object.extend("Payment");
    var payment = new PaymentClass();

    var value = paymentData["value"];
    var destination = paymentData["destination"];
    var input_address = paymentData["input_address"];
    var input_transaction_hash = paymentData["input_transaction_hash"];
    var transaction_hash = paymentData["transaction_hash"];

    payment.set("value", value);
    payment.set("destination", destination);
    payment.set("inputAddress", input_address);
    payment.set("inputTransactionHash", input_transaction_hash);
    payment.set("transactionHash", transaction_hash);
    payment.save();

    console.log('payment saved');
    response.success();
});

Parse.Cloud.afterSave("Payment", function(request) {
  Parse.Cloud.useMasterKey();
  var inputAddress = request.object.get("inputAddress");
  var value = request.object.get("value");

  console.log('searching for matching paymentForward for input address: ' + inputAddress);

  var paymentForward = Parse.Object.extend("PaymentForward");
  var query = new Parse.Query(paymentForward);
  query.equalTo("inputAddress", inputAddress);
  query.include("user")
  query.find({
    success: function(results) {
      var object = results[0];
      var user = object.get("user");

      var currentBalance = parseInt(user.get("balance"));
      var newBalance = parseInt(currentBalance + value);
      console.log('new balance: ' + newBalance);
      user.set("balance", newBalance);
      user.save();
    },
    error: function(error) {
      alert("Error: " + error.code + " " + error.message);
    }
  });
});


//Wait for deposit(s) to the wallets created above
// Parse.Cloud.define("transaction_received", function(request, response) {
//     // if (request.params.data) {
//     var transactionData = request.params;
//     // var outputs = transactionData.outputs;
//     console.log('transaction received: ' + transactionData.confirmations);
//     console.log('outputs: ' + JSON.stringify(transactionData.outputs, null, null));
//
//     response.success();
// });

// Parse.Cloud.define("broker_transaction_received", function(request, response) {
//   if (request.params.data) {
//     console.log('broker transaction received with ' + request.params.data.confirmations + ' confirmations');
//     // if (request.params.data.confirmations == 1) { //increase to 3!  block.io requires 3 confirmations
//     //
//     // };
//   };
//   response.success();
// });

//After transaction saved, forward to 1broker
// Parse.Cloud.afterSave("Transaction", function(request) {
//   console.log('transaction saved!');
//   var amount = request.object.get("balanceChange");
//   console.log(amount);
//   var address = request.object.get("address");
//   console.log(address);
//   Parse.Cloud.httpRequest({
//     url: 'https://1broker.com/api/v1/account/bitcoindepositaddress.php?token=24727a21f9effcdce3363a712cfc1f66&pretty=1',
//     success: function (d) {
//       var addressData = JSON.parse(d.text);
//       var brokerAddress = addressData.response.bitcoin_address;
//       console.log('current broker address: ' + brokerAddress);
//       Parse.Cloud.httpRequest({
//         url: 'https://block.io/api/v2/withdraw_from_addresses/?api_key=6cc7-b07d-b22b-f6d2&from_addresses='+address+'&to_addresses=' + brokerAddress + '&amounts='+amount+'&pin=wealthcoin',
//         success: function (d) {
//           console.log(d.data);
//           Parse.Cloud.httpRequest({
//             url: 'https://block.io/api/v2/create_notification/?api_key=6cc7-b07d-b22b-f6d2&type=address&address=' + brokerAddress + '&url=https://9uH7wnXCApdzv4vtL38fN8w1F8YpWXzzqhx9ITtp:javascript-key%3DTi6naCnm6CVBjo5iAjljsV8ByduSBWnj2OSCF8ZL@api.parse.com/1/functions/broker_transaction_received',
//             success: function (d) {
//               console.log(d.text);
//             },
//             error: function () {
//               console.error('error creating broker notification');
//             }
//           });
//         },
//         error: function () {
//           console.error('error withdrawing from address');
//         }
//       });
//     },
//     error: function () {
//       console.error('error getting address');
//     }
//   });
// });


Parse.Cloud.define("get_broker_balance", function(request, response) {
  Parse.Cloud.httpRequest({
    url: 'https://1broker.com/api/v1/account/info.php?token=24727a21f9effcdce3363a712cfc1f66&pretty=1',
    success: function (d) {
      response.success(d.data);
    },
    error: function () {
      response.error();
    }
  });
});
