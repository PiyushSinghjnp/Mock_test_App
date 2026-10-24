        $.fn.jctextcopyprotector= function(settings) {
            settings = $.extend({
                blockRightClick:true,
                blockDocTextSelection:true,
                useCSS:true,
                blockPageSave:true,
                alertUser:false,
                alertMessage:'Sorry! Content copy is not allowed?',
                callback:function(){}
            },settings);
            if(settings.blockDocTextSelection && !settings.useCSS) {
                $(document)[0].onselectstart = function(evt) {
                    if(settings.alertUser && settings.alertMessage.length > 0) {
                        alert(settings.alertMessage);
                    }
                    evt.preventDefault();
                    return false;
                };
            }
            else if(settings.blockDocTextSelection && settings.useCSS) {
                $('html,body').css({
                    '-webkit-touch-callout': 'none;',
                    '-moz-user-select':'none',
                    '-webkit-user-select':'none',
                    'user-select':'none',
                    '-ms-user-select':'none',
                    '-khtml-user-select': 'none'
                });
            }
            if(settings.blockPageSave) {
                $(document).keydown(function(e) {
                    if (e.ctrlKey && (e.which == 85|| e.which == 83 || e.which == 115 || e.which == 97 || e.which == 65 || e.which == 67 || e.which == 99)) { // blocks CTRL c (copy)+a(select all)+s(save)
                        if(settings.alertUser && settings.alertMessage.length > 0) {
                            alert(settings.alertMessage);
                        }
                        e.preventDefault();
                        return false;
                    }
                });
            }
        };
        function disableSelection(target){
            if (typeof target.onselectstart!="undefined") //IE route
                target.onselectstart=function(){return false}
        }
        $(document).ready(function(){
             $(document).bind("contextmenu",function(e){
                 return false;
            });
            $().jctextcopyprotector();
            disableSelection(document)
        });