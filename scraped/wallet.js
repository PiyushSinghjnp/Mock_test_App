function countdown(counter, divid){
    this.cs = counter;
    this.elem = document.getElementById(divid);
    this.update();
}
 
countdown.prototype.getdisp=function(seconds, maxval){
    var tmp = Math.abs((tmp = seconds/maxval)) < 1? 0 : tmp;
    return Math.abs(tmp < 0 ? Math.ceil(tmp) : Math.floor(tmp));
}
 
countdown.prototype.calculate=function(){
    var seconds = this.cs - 1;
    this.cs -= 1;
	this.days = this.getdisp(seconds, 86400);;
    this.hours = this.getdisp((seconds-(this.days*86400)),3600);
    this.mins = this.getdisp((seconds-(this.days*86400)-(this.hours*3600)),60);
    this.secs = this.getdisp((seconds-(this.days*86400)-(this.hours*3600)-(this.mins*60)),1);
}
 
countdown.prototype.update=function(){
    this.calculate();
    if(this.cs >= 0)
    {
        curelmhtml = '';
        if(this.days > 0)
        {
            curelmhtml = "<span class='hdr-time-box'>" + this.days + "</span> " + "<span class='hdr-time-sep'>" + (this.days == 1? "Day" : "Days") + " </span>" 
        }
        if(window.innerWidth > 991){
        curelmhtml +=  "<span class='hdr-time-box'>" + (this.hours < 10? "0"+this.hours : this.hours) + "</span> " + "<span class='hdr-time-sep'>" + ":" + "</span>" +
            " <span class='hdr-time-box'>" + (this.mins < 10? "0"+this.mins : this.mins) + "</span> " + "<span class='hdr-time-sep'>" + ":" + "</span>" +
            " <span class='hdr-time-box'>" + (this.secs < 10? "0"+this.secs : this.secs) + "</span> "; 
        }else{
            curelmhtml +=  "<span class='pr_txt'>"+wbtext+"</span><div class='ot-timer'><div class='tp-time'><span class='hdr-time-box'>" + (this.hours < 10? "0"+this.hours : this.hours) + "</span><span class='sub-txt'>HR</span></div>" + "<span class='hdr-time-sep'>" + ":" + "</span>" +
            "<div class='tp-time'> <span class='hdr-time-box'>" + (this.mins < 10? "0"+this.mins : this.mins) + "</span><span class='sub-txt'>MIN</span> </div> " + "<span class='hdr-time-sep'>" + ":" + "</span>" +
            "<div class='tp-time'> <span class='hdr-time-box'>" + (this.secs < 10? "0"+this.secs : this.secs) + "</span><span class='sub-txt'>SEC</span></div></div> "; 

        }


        this.elem.innerHTML = curelmhtml;
        var self = this;
        setTimeout(function(){self.update();}, (1000));
    }
    else
    {   
        $('.tp-wallet').hide();
    }
}
