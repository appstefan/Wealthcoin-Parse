// Use Parse.Cloud.define to define as many cloud functions as you want.
// For example:
 
//Call Cloud functions with:
//https://9uH7wnXCApdzv4vtL38fN8w1F8YpWXzzqhx9ITtp:javascript-key%3DTi6naCnm6CVBjo5iAjljsV8ByduSBWnj2OSCF8ZL@api.parse.com/1/functions/ANY_FUNCTION

//Make user a wallet.
Parse.Cloud.afterSave("_User", function(request) {
    Parse.Cloud.httpRequest({
      url: 'https://block.io/api/v2/get_new_address/?api_key=4387-0e9d-63b7-d7f7',
      success: function (d) {

        var walletData = JSON.parse(d.text);
  
        var WalletClass = Parse.Object.extend("Wallet");
        var wallet = new WalletClass();
  
        // wallet.set("owner", request.user);
        wallet.set("publicKey", walletData.data.address);
        wallet.set("owner", request.object);
        //... add other wallet proerties
        wallet.save();
        console.log(walletData.data.address);

        Parse.Cloud.httpRequest({
          url: 'https://block.io/api/v2/create_notification/?api_key=4387-0e9d-63b7-d7f7&type=address&address=' + walletData.data.address + '&url=https://9uH7wnXCApdzv4vtL38fN8w1F8YpWXzzqhx9ITtp:javascript-key%3DTi6naCnm6CVBjo5iAjljsV8ByduSBWnj2OSCF8ZL@api.parse.com/1/functions/transaction_received',
          success: function (d) {
            console.log(d.text);
          },
          error: function () {
            console.error('error' + d.text);
          }
        });
      },
      error: function () {
        console.error("not working properly");
      }
    });
});

//Wait for deposit(s) to the wallets created above
Parse.Cloud.define("transaction_received", function(request, response) {
    if (request.params.data) {
      console.log('transaction recieved with ' + request.params.data.confirmations + ' confirmations');
      if (request.params.data.confirmations == 1) {
        console.log('saving transaction...');

        var address = request.params.data.address;
        var balanceChange = request.params.data.balance_change;
        var txid = request.params.data.txid;

        var TransactionClass = Parse.Object.extend("Transaction");
        var transaction = new TransactionClass();

        transaction.set("balanceChange", balanceChange);
        transaction.set("txID", txid);
        transaction.set("address", address);
        transaction.save();

      };
    };
    response.success();
});

//After transaction saved, forward to 1broker
Parse.Cloud.afterSave("_Transaction", function(request) {
  console.log('transaction saved!');

  var TransactionClass = Parse.Object.extend("Transaction");



});





















