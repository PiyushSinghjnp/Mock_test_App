var cqno = 0;
var secindex=0;
var selstatus='';
var stsetter=0;
var preSecTotQu=0;
var countNuQ= parseInt(secount[secindex]);
var updateindex=-1;
var curlang='eqt';
var state=true;
var soladisExamid = '';
var soladisQid = '';
var soladisAccesstime = '';
var lastcommentid = {};
var ncloaded = {};
var nctotal = {};
var soladisLastpostid = '';
var isadminuser = 0;
var ww;

$(document).ready(function(){
    $("#side-panel-overlay").hide();
    ww = $(window).width(); 
    $("#slider-trigger").hide();
    if (wrongContainer.length == 0) {
        $("#chkwrong").hide();
    }
    if (unatContainer.length == 0) {
        $("#chkunat").hide();
    }
    crypt(cqno,1);
    var discq=$("#qblock-"+cqno).html();
    $(".discurqno").html(parseInt(cqno) + 1);
    $(".discquestion").html(discq);	
    calvideoheight();
});
$(window).load(function(){
    assignHeight();
});
$(window).resize(function(){
    assignHeight();
    ww = $(window).width();
    if (ww <= 991){
        sliderTrigger();
    }
});
$("#slider-trigger").on("click", function(){
    sliderTrigger();
 });
$("#m-slider").on("click", function(){
   sliderTrigger(); 
});
$("#side-panel-overlay").on("click", function(){ 
  sliderTrigger();
  $("#m-slider").css("display","flex");
})
function sliderTrigger(){
    if(ww >= 768){
        if($("#slider-trigger").hasClass("open")){
            $("#slider-trigger").find("i").removeClass("fa-chevron-right");
            $("#slider-trigger").find("i").addClass("fa-chevron-left");
            $(".right-col").hide();
            $("#questionssols-block").css("width", "100%");
            $("#slider-trigger").css("right", "0");
            $("#slider-trigger").removeClass("open");
        }else{
            $("#slider-trigger").find("i").removeClass("fa-chevron-left");
            $("#slider-trigger").find("i").addClass("fa-chevron-right");
            $(".right-col").show();
            $("#questionssols-block").css("width", "calc(100% - 320px);");  
            $("#slider-trigger").css("right", "320px");
            $("#slider-trigger").addClass("open");
        }
    }
    else{
        if($("#slider-trigger").hasClass("open")){
            $("#slider-trigger").find("i").removeClass("fa-chevron-right");
            $("#slider-trigger").find("i").addClass("fa-chevron-left");
            $(".right-col").hide();
            $("#side-panel-overlay").hide();
            $("#slider-trigger").css("right", "0");
            $("#slider-trigger").removeClass("open");
        }else{
            $("#slider-trigger").find("i").removeClass("fa-chevron-left");
            $("#slider-trigger").find("i").addClass("fa-chevron-right");
            $(".right-col").show();
            $("#side-panel-overlay").show();
            $("#m-slider").hide();
            $("#slider-trigger").css("right", "320px");
            $("#slider-trigger").addClass("open");
        }
    }
}

function assignHeight(){
    var ww = $(window).width();
    var wh = $(window).height();
    if(ww > 767){
        $(".paneqcol").height(wh - 212);
        $(".singlequestion").height(wh - 212);
        $("#sec-solview").height(wh - 58);
        $("#questionssols-block").css("height","auto");
    }else{
        $("#questionssols-block").height(wh - 158);
        $("#sec-solview").height(wh - 44);
        $(".paneqcol").css("height","auto");
        $(".singlequestion").css("height","auto");
    }
}
$(".totop").hide();
$(function(){
    $("#sec-sollanding, #questionssols-block, .singlequestion, #panecol-question").scroll(function(){
        if ($(this).scrollTop()>300)
        {
            $('.totop').fadeIn();
        } 
        else
        {
            $('.totop').fadeOut();
        }
    });
    $('.totop').click(function (e) {
        e.preventDefault();
        $('#sec-sollanding, #questionssols-block, .singlequestion, #panecol-question').animate({scrollTop: 0}, 500);
    });
 });
$("body").on("click", function(e){
    if ($(e.target).closest('.btn-dropdown').length === 0) {
        $(".ddn-collapse").slideUp();
        $(".btn-dropdown").removeClass("in");
    }
});
$(document).on("click",".change-lang",function(){
    if(curlang=="hqt"){
        curlang="eqt";
        $(".eqt").show();
        $(".hqt").hide();
        $(this).attr('src','img/lang-english.svg');
    }else{
        curlang="hqt";
        $(".hqt").show();
        $(".eqt").hide();
        $(this).attr('src','img/lang-hindi.svg');
    }

});
$(".btn-dropdown").on("click", function(){
    if(!($(this).hasClass("in"))){
        $(".ddn-collapse").slideDown();
        $(this).addClass("in");
    }else{
        $(".ddn-collapse").slideUp();
        $(this).removeClass("in");
    }
});
var shsummarystat = 0;
$("#shsummary").on("click", function(){
    if(shsummarystat == 0){
        $("#sec-summary").slideUp();
        $(this).attr('src', 'img/ic-movedown.svg');
        $(this).css("margin-top", "5px");
        shsummarystat = 1;
    }else{
        $("#sec-summary").slideDown();
        $(this).attr('src', 'img/ic-moveup.svg');
        $(this).css("margin-top", "-16px");
        shsummarystat = 0;
    }
});
$(".ddn-collapse li").on("click", function(){
    var getid=$(this).attr("id");
    getid=getid.split("-");
    getid=getid[1];
    secindex=getid;
    var ww=$(window).width();
    if(ww >= 768){
        var cursecname=dsnames[secindex];
    }else{
        var cursecname=ssnames[secindex];
    } 		
    $(".ddn-select").html(cursecname);
    $(".ddn-collapse").slideUp();
    $(".btn-dropdown").removeClass("in");
    $('[id^=q-'+cqno+'-]').hide();
    movenxtSection();
    if(stsetter){
        if(selstatus=="chkunat"){
            cqno= findfirstq(unatContainer);
            updateindex=unatContainer.indexOf(cqno);
        }
        if(selstatus=="chkwrong"){
            cqno= findfirstq(wrongContainer);
            updateindex=wrongContainer.indexOf(cqno);
        }
    }else{
        cqno=preSecTotQu;
    }
    displayQuestion();

});
$(".cuc-review").on("click", function(){
    if(!($(this).hasClass("in"))){
        $(".cuc-review").find('img').attr("src", "img/ic-uncheck.svg");
        $(".cuc-review").removeClass("in");
        $(this).find('img').attr("src", "img/ic-check.svg");
        $(this).addClass("in");
        selstatus=$(this).attr("id");
        if(selstatus=="chkunat"){
            $(".review-row").hide();
            $(".reviewq-unat").css("display", "flex");
            $(".reviewheader").css("display", "flex");
            $(".ddn-collapse li").show();
            var resarr=checksections(unatContainer);
            for(var sid=0;sid<secount.length;sid++){
                if(!(resarr[sid])){
                    $("#ssk-"+sid).hide();
                }
            }
        }
        if(selstatus=="chkwrong"){
            $(".review-row").hide();
            $(".reviewq-wrong").css("display", "flex");
            $(".reviewheader").css("display", "flex");
            $(".ddn-collapse li").show();
            var resarr=checksections(wrongContainer);
            for(var sid=0;sid<secount.length;sid++){
                if(!(resarr[sid])){
                    $("#ssk-"+sid).hide();
                }
            }
        }
        stsetter=1;
    }else{
        $(this).find('img').attr("src", "img/ic-uncheck.svg");
        $(this).removeClass("in");
        $(".review-row").css("display", "flex");
        $(".ddn-collapse li").show();
        stsetter=0;
    }
    
});
function viewsolution(curid, coropt){
    $("#opt-"+curid+"-"+coropt).addClass("correct");
    $("#alert-"+curid).slideUp();
    $("#sol-"+curid).slideDown();
    $("[id^=opt-"+curid+"-]").removeClass("cursorst");
    $("[id^=opt-"+curid+'-]').removeAttr("onclick");
    $('#questionssols-block').animate({scrollTop:$('#sol-'+cqno).offset().top}, 400);
}
function displayQuestion(){
    $(".map-qno").removeClass("activeq");
    $(".q-"+cqno).addClass("activeq");
    $('.updateqno').html(parseInt(cqno) + 1);
    if(timeacc[parseInt(cqno) + 1][0] != '--')
        $('#qttaken').text(" " + timeacc[parseInt(cqno) + 1][0]+"s ");
    else
        $('#qttaken').text(" " + timeacc[parseInt(cqno) + 1][0]);
    $('#qacc').text(timeacc[parseInt(cqno) + 1][1]);
    $('[id^=q-'+cqno+'-]').css("display", "flex"); 
    crypt(cqno,1);
    if(curlang == "eqt"){
        $(".eqt").show();
        $(".hqt").hide();
    }else{
        $(".hqt").show();
        $(".eqt").hide();
    }
    $('#questionssols-block').animate({scrollTop: 0}, "fast");
    $(".ddn-collapse").slideUp();
    $(".btn-dropdown").removeClass("in");
    //change language part
    var langstatus = $('[id^=q-'+cqno+'-]').attr('id');
    langstatus = langstatus.split('-')[3];
    if(langstatus == '1'){
        $(".change-lang").css("visibility", "visible");
    }else{
        $(".change-lang").css("visibility", "hidden");
    }
    //discuss part
    var discq=$("#qblock-"+cqno).html();
    $(".discurqno").html(parseInt(cqno) + 1);
    $(".discquestion").html(discq);
    checkReportErrorStatus();
    updateSaveImage(cqno);
}
function nextQuestion()
{
$('[id^=q-'+cqno+'-]').hide();
if ((parseInt(cqno))== (totalnq-1)){
    secindex=-1;
}
if(stsetter){
    if(selstatus=="chkunat"){
        if(updateindex==(unatContainer.length-1)){
            updateindex=-1;
        }
        updateindex++;
        cqno = parseInt(unatContainer[updateindex]);
    }
    if(selstatus=="chkwrong"){
        if(updateindex==(wrongContainer.length-1)){
            updateindex=-1;
        }
        updateindex++;
        cqno = parseInt(wrongContainer[updateindex]);
    }
    secindex=findsection(cqno);
    var ww=$(window).width();
        if(ww >= 768){
            var cursecname=dsnames[secindex];
        }else{
            var cursecname=ssnames[secindex];
        }
        $(".ddn-select").html(cursecname);
}else{
    if(cqno == (countNuQ - 1)){
        secindex++;
        var ww=$(window).width();
        if(ww >= 768){
            var cursecname=dsnames[secindex];
        }else{
            var cursecname=ssnames[secindex];
        }
        $(".ddn-select").html(cursecname);
        movenxtSection();
    }
    if ((parseInt(cqno))== (totalnq-1)){ 
        cqno = 0;
    }else{
        cqno++;
    }
}
displayQuestion();
}
function previousQuestion()
{
$('[id^=q-'+cqno+'-]').hide();
if ((parseInt(cqno))== 0){
    secindex=secount.length;
}
if(stsetter){
    if(selstatus=="chkunat"){
        if(updateindex==0){
            updateindex=unatContainer.length;
        }
        updateindex--;
        cqno = parseInt(unatContainer[updateindex]);
    }
    if(selstatus=="chkwrong"){
        if(updateindex==0){
            updateindex=wrongContainer.length;
        }
        updateindex--;
        cqno = parseInt(wrongContainer[updateindex]);
    }
    secindex=findsection(cqno);
    var ww=$(window).width();
        if(ww >= 768){
            var cursecname=dsnames[secindex];
        }else{
            var cursecname=ssnames[secindex];
        }
        $(".ddn-select").html(cursecname);
}else{
    if(cqno == (preSecTotQu)){
        secindex--;
        var ww=$(window).width();
        if(ww >= 768){
            var cursecname=dsnames[secindex];
        }else{
            var cursecname=ssnames[secindex];
        }
        $(".ddn-select").html(cursecname);
        movenxtSection();
    }
    if ((parseInt(cqno))== 0){ 
        cqno = parseInt(totalnq-1);
    }else{
        cqno--;
    }
}
displayQuestion();
}
function goToQuestion(cno)
{
    $(".map-qno").removeClass("activeq");
    $(".q-"+cno).addClass("activeq");
    $("#side-panel-overlay").hide();
    var ww = $(window).width(); 
    if(ww >= 768){
        $(".right-col").show();
        $("#slider-trigger").show();
        $("#questionssols-block").css("width", "calc(100% - 320px);");
        $("#slider-trigger").css("right", "320px");
        $("#slider-trigger").addClass("open");
        $("#slider-trigger").find("i").removeClass("fa-chevron-left");
        $("#slider-trigger").find("i").addClass("fa-chevron-right");
    }
    else{
         $(".right-col").hide();
         $("#slider-trigger").hide();
         $("#m-slider").css("display","flex");
         $("#questionssols-block").css("width", "100%");
         $("#slider-trigger").removeClass("open");
    }
$('#sec-sollanding').hide();
$('#sec-solview').show();
$('[id^=q-'+cqno+'-]').hide();
if(stsetter){
    if(selstatus == "chkunat"){
        updateindex=unatContainer.indexOf(cno);
    }
    if(selstatus == "chkwrong"){
        updateindex=wrongContainer.indexOf(cno);
    }
}
secindex=findsection(cno);
var ww=$(window).width();
    if(ww >= 768){
        var cursecname=dsnames[secindex];
    }else{
        var cursecname=ssnames[secindex];
    }
    $(".ddn-select").html(cursecname);
    $(".totop").hide();
cqno=cno;
movenxtSection();
displayQuestion();
}
function movenxtSection(){
    preSecTotQu=0;
    countNuQ=0;
    for(var ct=0; ct < secindex; ct++){
        var pstot= secount[ct];
        preSecTotQu += pstot;
    }
    countNuQ=parseInt(secount[secindex]) + parseInt(preSecTotQu);
}
function findsection(cno){
    var sc = secount[0];
    i = 0;
    while (cno >= sc){
        i++;
        sc += secount[i];
    }
    return i;
}
function gotoreview(){
$("#m-slider").hide();
$("#right-col").hide();
$("#slider-trigger").css("display","none");
    encryptIfAny();
    $('#sec-solview').hide();
    $('#sec-sollanding').show();
    $(".totop").hide();
}
function checksections(qarr){
    var res = [];
    var startqid = 0;
    var endqid = secount[0];
    for(var sid=0;sid<secount.length;sid++){
        res.push(0);
        for(var qid=0;qid<qarr.length;qid++){
            if((qarr[qid] > startqid) && (qarr[qid] < endqid)){
                res[sid] = 1;
                break;
            }
        }
        startqid += secount[sid];
        if(sid < secount.length - 1){
            endqid += secount[sid+1];
        }
    }
    return res;

}
function findfirstq(qarr){
    var startqid = preSecTotQu;
    var endqid = countNuQ;
    for(var i=0;i<qarr.length;i++){
        if((qarr[i] >= startqid) && (qarr[i] <= endqid)){
                return qarr[i];
        }
    }
    return -1;
}

var prevopt = null;
function attemptAgain(coropt, opt, curid){
    if(coropt == opt){
        $("[id^=opt-"+curid+'-]').removeClass("cursorst");  
        $("#opt-"+curid+"-"+prevopt).removeClass("wrong");
        $("#opt-"+curid+"-"+coropt).addClass("correct");
        $("#alert-"+curid).slideUp();
        $("#sol-"+curid).slideDown();
        $("[id^=opt-"+curid+'-]').removeAttr("onclick");
    }else{
        $("#opt-"+curid+"-"+prevopt).removeClass("wrong");
        $("#opt-"+curid+"-"+opt).addClass("wrong");
    }
    prevopt = opt;
}

/* discuss part */
$("#mv-dislide,#overlay-slide").click(function () {
    var fromReview = $("#sec-sollanding").is(":visible");
    var ww= $(window).width();
    var rtval1=parseInt(ww - 44);
    var rtval2 = 0;
    if(ww >= 768){
        rtval1 = 360;
        rtval2 = 16;
    }
    if (state) {
        $( "#mv-dislide" ).animate({
          right: rtval1
        }, 200 );
        if(!fromReview){
            loadposts(examid,parseInt(cqno) + 1);
        }
     } else {
        $( "#mv-dislide" ).animate({
          right: rtval2
        }, 200 );
     }
    // Set the effect type
    var effect = 'slide';
    // Set the options for the effect type chosen
    var options = { direction: 'right' };
    // Set the duration (default: 400 milliseconds)
    var duration = 200;
    $('#discuss-slide').toggle(effect, options, duration);
    $('#overlay-slide').toggle();
    $("#myqueries").hide();
    if(fromReview){
        $("#group-home").hide();
        $("#question-list").css("display","flex");
        $(".btn-qback").hide();
    } else {
        $("#group-home").css("display", "flex");
        $("#question-list").hide();
        $(".btn-qback").show();
    }
    state = !state; 
});
$(document).on('focus','.form-control',function(){
    $(this).attr('placeholder', '');
});
    $(document).on('blur','.form-control',function(){
    $(this).attr('placeholder', 'Ask your query...');
});
$("#btn-yourqueries").on("click", function(){
    $("#group-home").hide();
    loadmyqueries();
    $("#myqueries").css("display", "flex");
    $(".btn-qback").show();
});
$("#btn-qqlist").on("click", function(){
    $("#group-home").hide();
    $("#question-list").css("display", "flex");
    $(".btn-qback").show();
});
$(".btn-qback").on("click", function(){
    $("#question-list").hide();
    $("#myqueries").hide();
    $("#group-home").css("display", "flex");
    $('.box-question').show();
    $('.myqueryq').remove();
    $('.discuss-scroll, .discuss-scroll1').animate({scrollTop: 0}, 500);
});
$(document).on("click",".listboxq, .myqueryq", function(){
    if($("#chkwrong").hasClass("in")){
        $("#chkwrong").trigger( "click" );
    }
    if($("#chkunat").hasClass("in")){
        $("#chkunat").trigger( "click" );
    }
    var getid=$(this).attr("id");
    getid=getid.split("-");
    getid=getid[1];
    crypt(getid,1);
    goToQuestion(getid);
    loadposts(examid,parseInt(getid) + 1);
    var discq=$("#qblock-"+getid).html();
    $(".discurqno").html(parseInt(getid) + 1);
    $(".discquestion").html(discq);
    $("#question-list").hide();
    $("#myqueries").hide();
    $("#group-home").css("display", "flex");
    $('.discuss-scroll, .discuss-scroll1').animate({scrollTop: 0}, 500);

});
$(document).on("click",".btn-reporterror",function() {
  $("#modal-reporterror").addClass("is-active");  
});

$(document).on("click",".delete-remodal,#ermodalbg",function() {
   $("#modal-reporterror").removeClass("is-active");
   $('#edesc').val('');
});
/* video sol code */
function openmodal(videoid) {
  $('#videoframe').attr("src","//videos.sproutvideo.com/embed/"+videoid+"?type=sd");
  $("#modal-videosol").addClass("is-active");  
  calvideoheight();
}
$(document).on("click",".close-videosol",function() {
   $("#modal-videosol").removeClass("is-active");
  $('#videoframe').attr("src","");
});

function calvideoheight(){
    var videow = $('#videoframe').width();
    var videoh = (videow/16) * 9;
    $('#videoframe').height(videoh +'px');
}
/* video sol code */
function loadposts(examid,qid){
    $('.loadergif').show();
    $('.myqueryq').remove();
    $('.box-discuss').remove();
    $('#loadmoreposts').hide();
    $('#startdiscussion').hide();
    $('.box-question').show();
    $('.selfq-group').html('');
    soladisQid = qid;
    soladisExamid = examid;
    var sdata = {
        task: 'getposts',
        exam: soladisExamid,
        qid: soladisQid,
    };
    $.get('/solapp/read.php',sdata,function(result){
        if(result==-1){
            $('#startdiscussion').show();
            $('.loadergif').hide();
            return false;
        }
        result = JSON.parse(result);
        posts = result.posts;
        isadminuser = result.isadminuser;
        soladisAccesstime = result.accesstime;
        comments = result.comments;
        $('.loadergif').hide();
        $.each(posts,function(index,postdata){
            postid = postdata[0];
            var commentset =  (postid in comments) ? comments[postid] : [];
            var posthtml = genposthtml(postdata,commentset);
            $(posthtml).insertBefore('#loadmoreposts');
            nctotal[postid] = postdata[4]['nc'];
            soladisLastpostid = postid;
        });
        if(result.more == 1){
            $('#nmposts').text(result.nmposts);
            $('#loadmoreposts').show();
        }
    }).always(function(){
       $('.loadergif').hide();  
       beingrefreshed = 0;
    });
}
var postbeingentered = 0;
$(document).on('keydown','#postinput',function(e){
    if ( (postbeingentered == 0) && (e.which == 13) ) {
        postbeingentered = 1;
        var posttext = $('#postinput').val().trim();
        var regex = /(<([^>]+)>)/ig;
        posttext = posttext.replace(regex, " ");
        posttext = posttext.trim();
        if (posttext == ''){
            postbeingentered = 0;
            return false;
        }
        var sdata = {
            task : 'addpost',
            exam : soladisExamid,
            qid : soladisQid,
            posttext : posttext
        };
        $.post('/solapp/cgi/write.cgi',sdata,function(result){
            $('#postinput').val('');
            var posthtml = genselfposthtml(posttext);
            $('.selfq-group').append(posthtml);
            $('.discuss-scroll').animate({
                scrollTop: $('.discuss-scroll')[0].scrollHeight
            }, "slow");

        }).always(function(){
            postbeingentered = 0;
        });
    }
});

var commentbeingentered = 0;
$(document).on('keydown','.commentinput',function(e){
    if ((commentbeingentered == 0) && ( e.which == 13 )) {
        commentbeingentered = 1;
        var posttext = $(this).val().trim();
        var regex = /(<([^>]+)>)/ig;
        posttext = posttext.replace(regex, " ");
        posttext = posttext.trim();
        if (posttext == ''){
            commentbeingentered = 0;
            return false;
        }
        var pid  = parseInt($(this).attr('id').split('-')[1]);
        var sdata = {
            task : 'addcomment',
            exam : soladisExamid,
            qid : soladisQid,
            posttext : posttext,
            pid : pid
        };
        $.post('/solapp/cgi/write.cgi',sdata,function(result){
            $('#commentinput-'+pid).val('');
            result = result.trim();
            var cmt = [result,username,'',posttext];
            var posthtml = gencommenthtml(cmt);

            $('#cmt-list-'+pid).append(posthtml);
            //$('.discuss-scroll').animate({scrollTop: -$('#btnqueryrply-'+pid).offset().top+$('.discuss-scroll').offset().top},"slow");
        })
        .always(function(){
            commentbeingentered = 0;
        });

    }
});


function genselfposthtml(posttext){

    var htm = '<li>'+posttext+'</li>';
    return htm;
}
function gencommenthtml(cmt){
    var delhtml = '';
    if(isadminuser) { 
        delhtml = '<img class="img-delete" src="img/delete.svg" onclick="deletepost(' + cmt[0] +');" >';
    }
    htm = '<li id="post-'+cmt[0]+'"><h4>'+cmt[1]+'</h4><p>'+cmt[3]+delhtml+'</p></li>';
    return htm;
}

function genposthtml(postdata,comments){
    var postid = postdata[0];
    var posttext = postdata[3];
    var authorid = postdata[1];
    var posttime = postdata[2];
    var delhtml = '';
    if(isadminuser) { 
        delhtml = '<img src="img/delete.svg" onclick="deletepost(' + postid +');" class="img-delete">';
    }
    var htm = '<div class="box-discuss" id="post-'+postid+'"><div class="bd-col otherquery"><h4>'+authorid+'</h4><p>'+posttext+'</p>'+delhtml+'</div><div class="bd-col"><div class="pq-time"><span class="btn-queryrply" id="btnqueryrply-'+postid+'">Reply</span><span>&nbsp;|&nbsp;</span><span>'+posttime+'</span></div></div>';
    htm += '<div class="bd-col"><ul class="cmt-list" id="cmt-list-'+postid+'">';
    ncloaded[postid] = 0;
    for(cmt in comments){
        htm += gencommenthtml(comments[cmt]);
        ncloaded[postid] += 1;
    }
    if (ncloaded[postid] > 0){
        lastcommentid[postid] = comments[0][0];
    }
    htm += '</ul>';
    if(postdata[4].nc > comments.length){
        var lmcomments = postdata[4].nc - comments.length;
        htm += '<div id="loadmorecomments-'+postid+'" class="loadmorecomments loadmore-outer"><span>Load previous comments (<span id="lmcomments-'+postid+'">'+lmcomments+'</span>)...</span></div></div>';
    }
    htm += '<div class="commentinputdiv bd-col" style="display:none" id="commentinputdiv-'+postid+'"><div class="input-group"><input maxlength="300" id="commentinput-'+postid+'" class="form-control commentinput" type="textbox" placeholder="Write a reply.."></div></div></div>';
    return htm;
}
function focuspostinput(){
    $('#postinput').focus();
}
function focuspostinput2(){
    $('.btn-qback').trigger("click");
    $('#postinput').focus();
}
$(document).on('click','.btn-queryrply',function(){
    $('.commentinputdiv').hide();
    var postid = $(this).attr('id').split('-')[1];
    $('#commentinputdiv-'+postid).show();
    $('#commentinput-'+postid).focus();
});
$(document).on('click','.loadmorecomments',function(){
    var postid = $(this).attr('id').split('-')[1];
    var sdata = {
        task: 'getpreviouscomments',
        exam: soladisExamid,
        qid: soladisQid,
        postid: postid,
        lastpostid: lastcommentid[postid],
    };
    $.get('/solapp/read.php',sdata,function(result){
        result = JSON.parse(result);
        var comments = result.comments[postid];
        var htm = '';
        for(cmt in comments){
            htm += gencommenthtml(comments[cmt]);
            ncloaded[postid] += 1;
        }
        if(ncloaded[postid] > 0){
            lastcommentid[postid] = comments[0][0];
        }
        $('#cmt-list-'+postid).prepend(htm);
        if(nctotal[postid] <= ncloaded[postid]){
           $('#loadmorecomments-'+postid).hide();
        } else {
           $('#lmcomments-'+postid).text(nctotal[postid]-ncloaded[postid]);
        }
    });

});
$(document).on('click','#loadmoreposts',function(){
    $('#loadmoreposts').hide();
    var sdata = {
        task: 'getpreviousposts',
        exam: soladisExamid,
        qid: soladisQid,
        accesstime: soladisAccesstime,
        lastpostid: soladisLastpostid
    };
    $.get('/solapp/read.php',sdata,function(result){
        result = JSON.parse(result);
        posts = result.posts;
        if(!posts){
            return false;
        }
        comments = result.comments;
        $.each(posts,function(index,postdata){
            postid = postdata[0];
            var commentset =  (postid in comments) ? comments[postid] : [];
            var posthtml = genposthtml(postdata,commentset);
            $(posthtml).insertBefore('#loadmoreposts');
            nctotal[postid] = postdata[4]['nc'];
            soladisLastpostid = postid;
        });
        if(result.more == 1){
            $('#nmposts').text(result.nmposts);
            $('#loadmoreposts').show();
        }
    });
});
function loadmyqueries(){
    var sdata = {
        task: 'getmyposts',
        exam: soladisExamid,
    };
    $.get('/solapp/read.php',sdata,function(result){
        if(result==-1){
            $('.box-question').hide();
            $('#startmydiscussion').show();
            return false;
        }
        result = JSON.parse(result);
        var posts = result.posts;
        var htm = genmyposthtml(posts); 
        $('.box-question').hide();
        $('.discuss-scrollin').append(htm);
        $('#startmydiscussion').hide();

    });
}

function genmyposthtml(posts){
    var innerhtm = {};
    var outerhtm = '';
    $.each(posts,function(index,postdata){
        var qid = postdata[0];
        var postid = postdata[1];
        if (qid in innerhtm) {
            innerhtm[qid]  += '<li><p class="querypost">'+postdata[4]+'</p><span class="qptimer">'+postdata[3]+'</span></li>';
        } else {
            outerhtm += '<div id="myqueryq-'+(qid - 1) +'" class="box-query myqueryq"><div class="query-question"><h3>Question <span>' + (qid) + '</span></h3><div class="mqueryboxq"><p>'+urldecode(solArray[qid])+'</p></div></div><div class="myquery-group"><ul class="selfq-group">INNERHTM'+qid+'</ul></div></div>';
            innerhtm[qid]  = '<li><p class="querypost">'+postdata[4]+'</p><span class="qptimer">'+postdata[3]+'</span></li>';
        }
    });
    $.each(innerhtm,function(qid,innerhtmval){
        outerhtm = outerhtm.replace('INNERHTM'+qid,innerhtmval);
    });
    return outerhtm;
}

function urldecode(url) {
      return decodeURIComponent(url.replace(/\+/g, ' '));
}
var beingrefreshed = 0;
$(document).on('click','.soldis-refresh',function(result){
    if(beingrefreshed == 1){
        return false;
    }
    beingrefreshed = 1;
    loadposts(soladisExamid,soladisQid);
});
var postbeingdeleted = 0;
function deletepost(postid){
    if(postbeingdeleted == 1){
        return false;
    }

    var r  = confirm('Are you sure to delete the post?');
    if (r == false){
        return false;
    }
    postbeingdeleted = 1;
    var sdata = {};
    sdata['task'] = 'delpost';
    sdata['pid'] = postid;
    $.post('/solapp/cgi/write.cgi',sdata,function(result){
        if(result==0){
            $('#post-'+postid).remove();           
        }
    }).always(function(){
        postbeingdeleted = 0;
    });
}
/* switch */
$(".togreattempt").on("click",function(){
        window.location.href = reatturl;
});
