
function showoffermodal(){
    $('.modal-backdrop').show();
    $('.modal-backdrop').addClass('in');
    $('.hdr-main').css('z-index','1040');
    $('#modal-offerimg').modal('show');
    setCookiehours('offerimg','1',1);
}
    showoffermodal();
    $("#popupdismiss").on("click", function(){
        $('.modal-backdrop').removeClass('in');
        $('.modal-backdrop').hide();
    $('.hdr-main').css('z-index','1040');
    });
