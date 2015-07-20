// Use Parse.Cloud.define to define as many cloud functions as you want.
// For example:

//Call Cloud functions with:
//https://9uH7wnXCApdzv4vtL38fN8w1F8YpWXzzqhx9ITtp:javascript-key%3DTi6naCnm6CVBjo5iAjljsV8ByduSBWnj2OSCF8ZL@api.parse.com/1/functions/ANY_FUNCTION

//Make user a wallet.
var blockApiKey = '6cc7-b07d-b22b-f6d2';

Parse.Cloud.afterSave('_User', function(request) {
  if (!request.object.existed()) {
    // Parse.Cloud.useMasterKey();
    // var user = request.object;
    // user.set('balance', parseInt(0));
    // user.save();
    Parse.Cloud.httpRequest({
      url: 'https://block.io/api/v2/get_new_address/?api_key='+blockApiKey,
      success: function (response) {
        var walletData = JSON.parse(response.text);

        var network = walletData.data.network;
        var userId = walletData.data.user_id;
        var address = walletData.data.address;
        var label = walletData.data.label;
        var user = request.object;

        var WalletClass = Parse.Object.extend('Wallet');
        var wallet = new WalletClass();

        wallet.set("network", network);
        wallet.set("userId", userId);
        wallet.set("address", address);
        wallet.set("label", label);
        wallet.set("user", user);
        //... add other wallet proerties
        wallet.save();
        console.log('created wallet: ' + address);

        Parse.Cloud.httpRequest({
          url: 'https://block.io/api/v2/create_notification/?api_key='+blockApiKey+'&type=address&address=' + walletData.data.address + '&url=https://9uH7wnXCApdzv4vtL38fN8w1F8YpWXzzqhx9ITtp:javascript-key%3DTi6naCnm6CVBjo5iAjljsV8ByduSBWnj2OSCF8ZL@api.parse.com/1/functions/transaction_received',
          success: function (response) {
            var notificationData = JSON.parse(response.text);

            var network = notificationData.data.network;
            var notificationId = notificationData.data.notification_id;
            var type = notificationData.data.type;
            var enabled = notificationData.data.enabled;
            var url = notificationData.data.url;

            var NotificationClass = Parse.Object.extend('Notification');
            var notification = new NotificationClass();

            notification.set('network', network);
            notification.set('notificationId', notificationId);
            notification.set('type', type);
            notification.set('enabled', enabled);
            notification.set('url', url);
            notification.set('wallet', wallet);

            notification.save();

            console.log('notification created: ' + notificationId);
          },
          error: function (error) {
            console.error('error creating notification' + error.text);
          }
        });
      },
      error: function () {
        console.error("wallet create failed");
      }
    });
  }
});

Parse.Cloud.define("transaction_received", function(request, response) {
  var transactionData = request.params;
  if (transactionData.data) {
    var notificationId = transactionData.notification_id;
    var deliveryAttempt = transactionData.delivery_attempt;
    var confirmations = transactionData.data.confirmations;
    var address = transactionData.data.address;
    var amountReceived = transactionData.data.amount_received;
    var amountSent = transactionData.data.amount_sent;
    var balanceChange = transactionData.data.balance_change;
    var network = transactionData.data.network;
    var transactionId = transactionData.data.txid;
    var sentAt = transactionData.created_at;

    console.log("transaction received: " + notificationId);
    console.log("confirmations: " + confirmations);

    var TransactionClass = Parse.Object.extend('Transaction');
    var query = new Parse.Query(TransactionClass);
    query.equalTo('transactionId', transactionId);
    query.find({
      success: function(results) {
        if(results.length === 0) {
          console.log('making new transaction...');
          var transaction = new TransactionClass();

          transaction.set('notificationId', notificationId);
          transaction.set('deliveryAttempt', deliveryAttempt);
          transaction.set('confirmations', confirmations);
          transaction.set('address', address);
          transaction.set('amountReceived', amountReceived);
          transaction.set('amountSent', amountSent);
          transaction.set('balanceChange', balanceChange);
          transaction.set('network', network);
          transaction.set('transactionId', transactionId);
          transaction.set('sentAt', sentAt);

          transaction.save();
        } else {
          console.log('updating existing transaction...');
          var transaction = results[0];
          transaction.set("confirmations", confirmations);
          transaction.save();
        }
        response.success();
      },
      error: function(error) {
        alert("Error: " + error.code + " " + error.message);
        response.success();
      }
    });
  } else {
    console.log('ping received');
    response.success();
  };
});

Parse.Cloud.afterSave("Transaction", function(request) {
  var transaction = request.object;
  var confirmations = transaction.get('confirmations');
  var notificationId = transaction.get('notificationId');
  var deliveryAttempt = transaction.get('deliveryAttempt');
  var address = transaction.get('address');
  var amountReceived = transaction.get('amountReceived');
  var balanceChange = transaction.get('balanceChange');
  var sentAt = transaction.get('sentAt');

  console.log('transaction saved with balanceChange: ' + balanceChange);

  if (confirmations === 3) {
    if (balanceChange > 0) {
      console.log('forwarding to 1broker...');
      Parse.Cloud.httpRequest({
        method: 'GET',
        url: 'https://1broker.com/api/v1/account/bitcoindepositaddress.php?token=24727a21f9effcdce3363a712cfc1f66&pretty=1',
        success: function (addressResponse) {
          var newBrokerAddress = addressResponse.data.response.bitcoin_address;
          console.log('current broker address: ' + newBrokerAddress);
          var BrokerClass = Parse.Object.extend("Broker");
          var query = new Parse.Query(BrokerClass);
          query.first({
            success: function(object) {
              var broker = object;
              var currentBrokerAddress = object.get("address");
              if (currentBrokerAddress != newBrokerAddress) {
                console.log('broker address: ' + currentBrokerAddress + ' is deprecated. replacing with: ' + newBrokerAddress);
                broker.set("address", newBrokerAddress);
                broker.save();
              }
              Parse.Cloud.httpRequest({
                method: 'POST',
                url: 'https://block.io/api/v2/get_network_fee_estimate/?api_key='+blockApiKey+'&from_addresses='+ address +'&to_addresses='+ newBrokerAddress +'&amounts='+ balanceChange +'&pin=wealthcoin',
                success: function (response) {
                  var estimateData = JSON.parse(response.text);
                  var estimatedFee = estimateData.data.estimated_network_fee;
                  var withdrawAmount = (((balanceChange * 1000000)-(estimatedFee * 1000000)) / 1000000);
                  console.log('fee estimate: ' + estimatedFee + '| withdrawing: ' + withdrawAmount);
                  Parse.Cloud.httpRequest({
                    method: 'POST',
                    url: 'https://block.io/api/v2/withdraw_from_addresses/?api_key='+blockApiKey+'&from_addresses='+ address +'&to_addresses='+ newBrokerAddress +'&amounts='+ withdrawAmount +'&pin=wealthcoin',
                    success: function (response) {
                      var withdrawalData = JSON.parse(response.text);

                      var status = withdrawalData.status;
                      var network = withdrawalData.data.network;
                      var transactionId = withdrawalData.data.txid;
                      var amountWithdrawn = withdrawalData.data.amount_withdrawn;
                      var amountSent = withdrawalData.data.amount_sent;
                      var networkFee = withdrawalData.data.network_fee;
                      var blockioFee = withdrawalData.data.blockio_fee;

                      var WithdrawalClass = Parse.Object.extend('Withdrawal');
                      var withdrawal = new WithdrawalClass();
                      withdrawal.set('status', status);
                      withdrawal.set('network', network);
                      withdrawal.set('transactionId', transactionId);
                      withdrawal.set('amountWithdrawn', amountWithdrawn);
                      withdrawal.set('amountSent', amountSent);
                      withdrawal.set('networkFee', networkFee);
                      withdrawal.set('blockioFee', blockioFee);
                      withdrawal.save();
                      console.log('withdrawal created: ' + JSON.stringify(withdrawalData));
                    },
                    error: function (error) {
                      console.error('error creating withdrawal' + error.text);
                    }
                  });
                },
                error: function (error) {
                  console.error('error creating withdrawal' + error.text);
                }
              });
            },
            error: function(error) {
              alert("Error: " + error.code + " " + error.message);
            }
          });
        },
        error: function (error) {
          alert("Error: " + error.code + " " + error.message);
        }
      });
    } else {
      //moved here to avoid var duplication with withdrawal
      var amountSent = transaction.get('amountSent');
      var network = transaction.get('network');
      var transactionId = transaction.get('transactionId');

      var WithdrawalClass = Parse.Object.extend("Withdrawal");
      var query = new Parse.Query(WithdrawalClass);
      query.equalTo('transactionId', transactionId);
      query.first({
        success: function(withdrawalObject) {
          console.log('buying from 1broker...');

          var WalletClass = Parse.Object.extend("Wallet");
          var query = new Parse.Query(WalletClass);
          query.equalTo("address", address);
          query.include("user");
          query.find({
            success: function(results) {
              var object = results[0];
              var user = object.get("user");

              var portfolioPointer = user.get("portfolio");

              portfolioPointer.fetch({
                success: function(object) {
                  var portfolio = object;
                  var stockRatio = portfolio.get("stockRatio");
                  // var stockRatio = portfolio.get("stockRatio");
                  // var stockRatio = portfolio.get("stockRatio");
                  console.log('user: ' + user.get('username') + 'stockRatio: ' + stockRatio);
                  // var buyRequest = {
                  //   'stockRatio' : stockRatio,
                  //   'total' : total
                  // };
                  // Parse.Cloud.run('perform_broker_buy', buyRequest, {
                  //   success: function() {
                  //
                  //   },
                  //   error: function(error) {
                  //
                  //   }
                  // });
                },
                error: function(object, error) {
                  console.console.error('error fetching porfolio: ' + error.message);
                }
              });
            },
            error: function(error) {
              alert("Error querying wallet: " + error.code + " " + error.message);
            }
          });
        },
        error: function(error) {
          console.log('no matching withdrawal found with txID: ' + transactionId);
        }
      });
    }
  }
});

Parse.Cloud.define("perform_broker_buy", function(request, response) {
  var stockMargin = ((request.params.total * request.params.stockRatio)/1000000);
  console.log('stockMargin: ' + stockMargin);
  // response.success();

  Parse.Cloud.httpRequest({
    url: 'https://1broker.com/api/v1/order/create.php?symbol=SP500&margin=' + stockMargin + '&direction=long&leverage=1&order_type=Market&token=24727a21f9effcdce3363a712cfc1f66&pretty=1',
    success: function (d) {
      console.log('buy success');
      response.success(d.params);
    },
    error: function (d) {
      console.log('buy error');
      response.error(d.params);
    }
  });
});

//keep around for reference future use
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
