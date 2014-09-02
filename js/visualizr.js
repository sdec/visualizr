/**
 * VISUALIZR
 * 
 * EaselJS: 
 *      - Tekenen van de balken
 *      - Afronding van de balken onder 1024 ttf
 *      - Tekenen van average, min, max
 *      
 * SoundJS:
 *      - Afspelen van geluid
 *      - Ophalen van frequency data
 *      
 * PreloadJS:
 *      - Laden van geluid
 *      
 * jQuery:
 *      - Verwerken van frequency data
 *      - Animatie
 *      - Controls
 *      - Javascript driven design
 *      
 * © Sander Decoster 2014
 */

/*
 * Omdat er enkel client-sided gewerkt wordt
 * is het nodig dat we op voorhand weten wat de namen van de 
 * liedjes zijn zodat we ze kunnen inladen.
 * 
 * De bestandnaam van een liedje op index i zal overeenkomen
 * met SongNames[i] + ".mp3"
 * 
 */
var SongNames = [
    "Gemini - Blue",
    "DJ Fresh - Gold Dust",
    "Black Eyed Peas - Pump It",
    "Mr. Bungle - Super Mario Bros. Theme"
];

// Constants
var FPS = 60;
var UPDATE_RATE_MS = 1000 / FPS;
var SOUND_PATH = "assets/sound/";
var SONG_PATH = SOUND_PATH + "songs/";
var STATIC_SOUNDS = 2; // ClickIn and ClickOut

// Variables
var canvas;
var stage;
var container;
var ballContainer;
var avgline;
var avglinetext;
var minline;
var minlinetext;
var maxline;
var maxlinetext;
var timer;
var clickSound;
var analyserNode;
var freqFloatData = [];
var freqByteData = [];
var queue;
var lastCanvasHeight;

var analyser = {
    open: false,            // Settings staan open/closed
    ttf: 512,               // TTF range
    smoothness: 0.90,       // Hoe soepel de balken bewegen
    color: 'cold',          // Kleur van de balken
    song: 0,                // Index van het liedje
    soundInstance : null,   // Instantie van het ingeladen geluid
    playing: false,         // Liedje is wel/niet aan het spelen
    paused: false,          // Liedje is wel/niet gepauzeerd
    loading: false,         // Liedjes zijn aan het laden
    loaded: 0,              // Aantal geladen liedjes
    average: false,         // Toon gemiddelde f
    minimum: false,         // Toon minimum f
    maximum: false,         // Toon maximum f
    atype: 'line',          // Hoe tonen (line/area)?
    volume: 1               // Volume (0 ... 1)
};

$(function() {

    init_compatibility();
    init_defaults();
    init_ticker();
    init_events();

    start();
    init_loadSongs();

});

function init_compatibility() {
    
    // Alleen web audio wordt ondersteund
    if (!createjs.Sound.initializeDefaultPlugins()) {
        alert("Only web audio is supported");
        return;
    }
}

function init_defaults() {

    // Canvas aanmaken en breedte/hoogte aanpassen
    canvas = document.getElementById('canvas');
    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;
    stage = new createjs.Stage(canvas);

    // SoundJS context aanmaken en settings initializeren
    var context = createjs.WebAudioPlugin.context;
    analyserNode = context.createAnalyser();
    analyserNode.fftSize = analyser.ttf;                 // The size of the FFT used for frequency-domain analysis. This must be a power of two
    analyserNode.smoothingTimeConstant = analyser.smoothness;  // A value from 0 -> 1 where 0 represents no time averaging with the last analysis frame
    analyserNode.connect(context.destination);  // connect to the context.destination, which outputs the audio

    var dynamicsNode = createjs.WebAudioPlugin.dynamicsCompressorNode;
    dynamicsNode.disconnect();  // disconnect from destination
    dynamicsNode.connect(analyserNode);

    freqFloatData = new Float32Array(analyserNode.frequencyBinCount);
    freqByteData = new Uint8Array(analyserNode.frequencyBinCount);

    // HTML componenten initializeren
    if (analyser.color === 'warm')
        $("#analyser-color-warm").prop('checked', true);
    else if (analyser.color === 'cold')
        $("#analyser-color-cold").prop('checked', true);
    else if (analyser.color === 'greyscale')
        $("#analyser-color-greyscale").prop('checked', true);
    else if (analyser.color === 'gradient')
        $("#analyser-color-gradient").prop('checked', true);

    if (analyser.ttf === 32) {
        $("#analyser-range-tiny").prop('checked', true);
    } else if (analyser.ttf === 64) {
        $("#analyser-range-compact").prop('checked', true);
    } else if (analyser.ttf === 512) {
        $("#analyser-range-regular").prop('checked', true);
    } else if (analyser.ttf === 1024) {
        $("#analyser-range-wide").prop('checked', true);
    } else if (analyser.ttf === 2048) {
        $("#analyser-range-broad").prop('checked', true);
    }

    $("#analyser-smoothness").val(analyser.smoothness * 1000);
    $("#analyser-smoothness-label").html(Math.round(analyser.smoothness * 100, 2) + "%");

    var s = $('<select id="song-select" />');
    s.appendTo($("#song"));
    
    lastCanvasHeight = $("#canvas").height();
}

function init_ticker() {
    // Ticker opzetten (vereist voor SoundJS)
    createjs.Ticker.setFPS(FPS);
    createjs.Ticker.addEventListener("tick", tick);
}

function init_events() {

    queue = new createjs.LoadQueue();
    queue.installPlugin(createjs.Sound);
    queue.addEventListener("complete", handleLoad);

    // Settings controls
    $("#panel").click(function() {
        open();
    });
    $("#close").click(function() {
        close();
    });
    $("#apply").click(function() {
        apply();
    });

    $("#analyser-smoothness").mouseup(function() {
        var smoothness = ($("#analyser-smoothness").val() / 1000);
        $("#analyser-smoothness-label").html(Math.round(smoothness * 100, 2) + "%");

        analyser.smoothness = smoothness;
        apply();
    });
    $("#analyser-color-cold").click(function() {
        analyser.color = 'cold';
        apply();
    });
    $("#analyser-color-warm").click(function() {
        analyser.color = 'warm';
        apply();
    });
    $("#analyser-color-greyscale").click(function() {
        analyser.color = 'greyscale';
        apply();
    });
    $("#analyser-color-gradient").click(function() {
        analyser.color = 'gradient';
        apply();
    });
    $("#analyser-range-tiny").click(function() {
        analyser.ttf = 32;
        apply();
    });
    $("#analyser-range-compact").click(function() {
        analyser.ttf = 128;
        apply();
    });
    $("#analyser-range-regular").click(function() {
        analyser.ttf = 512;
        apply();
    });
    $("#analyser-range-wide").click(function() {
        analyser.ttf = 1024;
        apply();
    });
    $("#analyser-range-broad").click(function() {
        analyser.ttf = 2048;
        apply();
    });
    $("#analyser-show-average").click(function() {
        analyser.average = $("#analyser-show-average").prop('checked') ? true : false;
        apply();
    });
    $("#analyser-show-minimum").click(function() {
        analyser.minimum = $("#analyser-show-minimum").prop('checked') ? true : false;
        apply();
    });
    $("#analyser-show-maximum").click(function() {
        analyser.maximum = $("#analyser-show-maximum").prop('checked') ? true : false;
        apply();
    });
    $("#analyser-analytics-line").click(function() {
        analyser.atype = 'line';
        apply();
    });
    $("#analyser-analytics-area").click(function() {
        analyser.atype = 'area';
        apply();
    });
    $("#analyser-volume").change(function() {
        var volume = $("#analyser-volume").val();
        $("#analyser-volume-label").html(volume + "%");

        analyser.volume = volume / 100;
        if(soundInstance !== null)
            soundInstance.setVolume(analyser.volume);
    });
    
    // Audio controls
    $("#play-pause").click(function() {
        if (analyser.playing === true) {
            pause();
            analyser.playing = false;
        } else {
            play();
            analyser.playing = true;
        }
    });
    $("#stop").click(function() {
        if (analyser.playing === true) {
            stop();
            analyser.playing = false;
        }
    });
    $("#song").change(function() {
        analyser.song = $("#song-select").val();
        stop();
        songChanged();
    });
    
    $("#panel").mouseleave(function() {
        if(analyser.open === true) {
            $("#panel").css('opacity', '0.2');
        }
    });
    $("#panel").mouseenter(function() {
        if(analyser.open === true) {
            $("#panel").css('opacity', '1.0');
        }
    });
}

function init_loadSongs() {

    analyser.loading = true;
    if (analyser.loaded === 0) {
        queue.loadFile({id: "clickIn", src: SOUND_PATH + "clickIn.mp3"});
        return;
    }
    else if (analyser.loaded === 1) {
        queue.loadFile({id: "clickOut", src: SOUND_PATH + "clickOut.mp3"});
        return;
    } else if ((analyser.loaded - STATIC_SOUNDS) <= SongNames.length) {
        var songidx = analyser.loaded - STATIC_SOUNDS;
        
        if (analyser.loaded - STATIC_SOUNDS < SongNames.length)
            queue.loadFile({id: songidx, src: SONG_PATH + SongNames[songidx] + ".mp3"});

        if (analyser.loaded - STATIC_SOUNDS > 0) {
            
            if(analyser.loaded - STATIC_SOUNDS === 1) {
                analyser.song = 0;
                songChanged();
            }
            
            var o = $('<option />', {value: songidx - 1, text: SongNames[songidx - 1]});
            o.appendTo($("#song-select"));
            if (analyser.loaded - STATIC_SOUNDS === SongNames.length)
                hideLoad(); // Done!
        }
        return;
    }
    analyser.loading = false;
    hideLoad();
}

function showLoad() {
    $("#loading").show();
}

function hideLoad() {
    $("#loading").hide();
}

function reload() {
    reset();
    if (analyser.playing === true) {
        analyser.playing = false;
        start();
        analyser.playing = true;
    } else {
        start();
    }
}

function reset() {
    stage.removeAllChildren();
    stage.update();
}

function songChanged() {
    var split = SongNames[analyser.song].split(" - ");
    var author = split[0];
    var songtitle = split[1];
    
    $("#songtitle").html(songtitle);
    $("#author").html(author);
    $("#abbreviation").html(author.substr(0, 2));
    
    var reference = window.innerWidth > window.innerHeight ? canvas.height : canvas.width;
    var titleFont = (reference / 10);
    var authorFont = titleFont / 2;
        
    $("#songtitle").css('font-size', titleFont + 'px');
    $("#author").css('font-size', authorFont + 'px');
    
    if(window.innerWidth < 1025 || window.innerHeight < 769) {
        
        var logosize = reference / 5;
        
        $("#logo").css('font-size', logosize / 1.5 + 'px');
        $("#logo").css('width', logosize);
        $("#logo").css('height', logosize);
        $("#logo").css('padding-left', logosize / 1.5 / 3 + 'px');
        $("#logo").css('padding-top', '0px');
        $("#songtitle").css('left', (logosize + (logosize / 10)) + 'px');
        $("#author").css('left', (logosize + (logosize / 10)) + 'px');
        $("#author").css('top', (titleFont + (authorFont / 2)) + 'px');
    }
    
    $("#logo").show();
    
}

function start() {

    analyserNode.fftSize = analyser.ttf;
    analyserNode.smoothingTimeConstant = analyser.smoothness;
    

    if (container) {
        container.removeAllChildren();
        ballContainer.removeAllChildren();
    }
    container = new createjs.Container();
    ballContainer = new createjs.Container();

    var spectrum = Math.round(analyser.ttf / 2 * getFreqUsed());
    var width = canvas.width;
    var height = canvas.height;

    var padding = analyser.ttf < 1025 ? (analyser.ttf / 512 * 6) : 0;
    var barWidth = (width - (spectrum * padding)) / spectrum;
    var color;
    
    for (var i = 0; i < spectrum; i++) {

        var bar = new createjs.Shape();

        switch (analyser.color) {
            case 'warm':
                color = "#F74100";
                break;
            case 'cold':
                color = "#000000";
                break;
            case 'greyscale':
                color = "#C0C0C0";
                break;
            case 'gradient':
                color = gradient[Math.floor((i / spectrum) * gradient.length) % gradient.length];
                break;
            default:
                color = "#F74100";
        }

        bar.graphics.beginFill(color).drawRect((i * barWidth) + (i * padding), height - getMinHeight(barWidth), barWidth, height);

        if (analyser.ttf < 1024) {
            var ball = new createjs.Shape();
            ball.graphics.beginFill(color).drawCircle((i * barWidth) + (i * padding) + barWidth / 2, height - getMinHeight(barWidth), barWidth / 2);
            ballContainer.addChild(ball);
        }
        container.addChild(bar);
    }

    stage.addChild(container);
    stage.addChild(ballContainer);
    
    var aheight = analyser.atype === 'line' ? 1 : canvas.height;
    var aalpha = analyser.atype === 'line' ? 1.0 : 0.4;
    
    maxline = new createjs.Shape();
    maxline.graphics.beginFill("#00FF00").drawRect(0, 0, width, aheight);
    maxline.y = height;
    maxline.alpha = aalpha;
    
    maxlinetext = new createjs.Text("", "bold 12px Arial", "#FFFFFF");
    maxlinetext.maxWidth = width;
    maxlinetext.x = 4;
    maxlinetext.y = 0;
    
    avgline = new createjs.Shape();
    avgline.graphics.beginFill("#000000").drawRect(0, 0, width, aheight);
    avgline.y = height;
    avgline.alpha = aalpha;

    avglinetext = new createjs.Text("", "bold 12px Arial", "#FFFFFF");
    avglinetext.maxWidth = width;
    avglinetext.x = 4;
    avglinetext.y = 0;
    
    minline = new createjs.Shape();
    minline.graphics.beginFill("#0000FF").drawRect(0, 0, width, aheight);
    minline.y = height;
    minline.alpha = aalpha;

    minlinetext = new createjs.Text("", "bold 12px Arial", "#FFFFFF");
    minlinetext.maxWidth = width;
    minlinetext.x = 4;
    minlinetext.y = 0;
    
    stage.addChild(maxlinetext);
    stage.addChild(maxline);
    stage.addChild(avglinetext);
    stage.addChild(avgline);
    stage.addChild(minlinetext);
    stage.addChild(minline);

    stage.update();

}

function calculate() {
    
    var avgF = 0;
    var minF = 99999;
    var maxF = 0;
    var count = 0;
    var spectrum = Math.round(analyser.ttf / 2 * getFreqUsed());
    var y = 0;
    
    // Reset first
    avgline.y = canvas.height;
    avglinetext.y = canvas.height + 16;
    minline.y = canvas.height;
    minlinetext.y = canvas.height + 16;
    maxline.y = canvas.height;
    maxlinetext.y = canvas.height + 16;
    
    // Recalculate
    for (var i = 0; i < spectrum; i++) {
        if (Math.round(freqByteData[i], 0) > 0) {
            
            if(analyser.average === true) {
                avgF += freqByteData[i];
            }
            
            if(analyser.minimum === true) {
                if(freqByteData[i] < minF) {
                    minF = freqByteData[i];
                }
            }
            
            if(analyser.maximum === true) {
                if(freqByteData[i] > maxF) {
                    maxF = freqByteData[i];
                }
            }
            
            count++;
        }
    }
    
    if(analyser.average === true) {
        avgF /= count;
        y = ((avgF / canvas.height) * canvas.height) * 2;
        avgline.y = canvas.height - y;
        avglinetext.y = canvas.height - y - 16;
        avglinetext.text = "Avg " + Math.round(avgF, 2) + "hz";
    }
    
    if(analyser.minimum === true) {
        y = ((minF / canvas.height) * canvas.height) * 2;
        minline.y = canvas.height - y;
        minlinetext.y = canvas.height - y - 16;
        minlinetext.text = "Min " + Math.round(minF, 2) + "hz";
    }
    
    if(analyser.maximum === true) {
        y = ((maxF / canvas.height) * canvas.height) * 2;
        maxline.y = canvas.height - y;
        maxlinetext.y = canvas.height - y - 16;
        maxlinetext.text = "Max " + Math.round(maxF, 2) + "hz";
    }
    
    // Self stopping timer
    if(analyser.playing === false) {
        clearInterval(timer);
    }
}

function handleLoad() {
    analyser.loaded++;
    init_loadSongs();
}

function tick() {
    if (analyser.playing === true) {

        analyserNode.getByteFrequencyData(freqByteData);  // this gives us the frequency

        for (var i = 0; i < container.getNumChildren(); i++) {
            var barHeight = -(((freqByteData[i] / canvas.height) * canvas.height) * 2);
            var bar = container.getChildAt(i);
            bar.y = barHeight;
            if (analyser.ttf < 1024) {
                var ball = ballContainer.getChildAt(i);
                ball.y = barHeight;
            }
        }
        stage.update();
    }
}

function play() {
    if (analyser.loaded <= analyser.song && (analyser.song + 1) !== SongNames.length) {
        setTimeout(play, 200);
        return;
    }
    if(analyser.paused === true) {
        analyser.paused = false;
        soundInstance.resume();
    }
    else if (analyser.playing === false && analyser.song >= 0 && analyser.song < SongNames.length) {
        soundInstance = createjs.Sound.play(SONG_PATH + SongNames[analyser.song] + ".mp3", {loop: true});
        soundInstance.setVolume(analyser.volume);
        analyser.playing = true;
        songChanged();

        timer = setInterval(calculate, FPS);

    }
}

function pause() {
    if (analyser.playing === true) {
        soundInstance.pause();
        analyser.paused = true;
        analyser.playing = false;
    }
}

function stop() {
    if (analyser.playing === true) {
        createjs.Sound.stop();
        analyser.paused = false;
        analyser.playing = false;
    }
}

function getClosestPowerOfTwo(num) {
    var pow = 32;
    while (pow < num) {
        pow *= 2;
    }
    return pow;
}

/* Panel functionality */

function open() {
    if (analyser.open === false) {
        createjs.Sound.play("clickIn", {loop: false});
        $("#apply-text").html("");
        $("#panel").animate({
            width: window.innerWidth <= 1024 ? window.innerWidth * 0.98 : window.innerWidth * 0.50
        }, 250, function() {
            $("#panel").animate({height: window.innerHeight <= 850 ? window.innerHeight * 0.98 : 850, opacity: 1.0}, 250, function() {
                analyser.open = true;
                $("#close").show();
            });
        });
    }
}

function close() {
    if (analyser.open === true) {
        createjs.Sound.play("clickOut", {loop: false});
        $("#close").hide();
        $("#panel").animate({
            height: 65
        }, 250, function() {
            $("#panel").animate({width: 174, opacity: 0.6}, 250, function() {
                analyser.open = false;
            });
        });
        $("#canvas").animate({
            height: lastCanvasHeight,
            top: window.innerHeight * 0.40 * -1,
            left: window.innerWidth * 0.10,
            width: window.innerWidth * 0.8
        }, 500);
    }
}

function apply() {
    reload();
    $("#apply-text").html("Changes applied!");
}

function getFreqUsed() {
    switch (analyser.ttf) {
        case 32:
            return 1;
        case 128:
            return 0.7;
        case 512:
            return 0.3;
        case 1024:
            return 0.125;
        case 2048:
            return 0.125 / 2;
    }
    return 0.95;
}

function getMinHeight(bw) {
    return analyser.ttf < 1024 ? -(bw / 2) : 0;
}

var gradient = [
    "#FF0000", "#FF0003", "#FF0006", "#FF0009", "#FF000C", "#FF000F", "#FF0012",
    "#FF0015", "#FF0018", "#FF001B", "#FF001E", "#FF0021", "#FF0024", "#FF0027",
    "#FF002A", "#FF002D", "#FF0030", "#FF0033", "#FF0036", "#FF0039", "#FF003C",
    "#FF003F", "#FF0042", "#FF0045", "#FF0048", "#FF004B", "#FF004E", "#FF0051",
    "#FF0055", "#FF0058", "#FF005B", "#FF005E", "#FF0061", "#FF0064", "#FF0067",
    "#FF006A", "#FF006D", "#FF0070", "#FF0073", "#FF0076", "#FF0079", "#FF007C",
    "#FF007F", "#FF0082", "#FF0085", "#FF0088", "#FF008B", "#FF008E", "#FF0091",
    "#FF0094", "#FF0097", "#FF009A", "#FF009D", "#FF00A0", "#FF00A3", "#FF00A6",
    "#FF00AA", "#FF00AD", "#FF00B0", "#FF00B3", "#FF00B6", "#FF00B9", "#FF00BC",
    "#FF00BF", "#FF00C2", "#FF00C5", "#FF00C8", "#FF00CB", "#FF00CE", "#FF00D1",
    "#FF00D4", "#FF00D7", "#FF00DA", "#FF00DD", "#FF00E0", "#FF00E3", "#FF00E6",
    "#FF00E9", "#FF00EC", "#FF00EF", "#FF00F2", "#FF00F5", "#FF00F8", "#FF00FB",
    "#FF00FF", "#FC00FF", "#FA00FF", "#F700FF", "#F500FF", "#F200FF", "#F000FF",
    "#EE00FF", "#EB00FF", "#E900FF", "#E600FF", "#E400FF", "#E200FF", "#DF00FF",
    "#DD00FF", "#DA00FF", "#D800FF", "#D600FF", "#D300FF", "#D100FF", "#CE00FF",
    "#CC00FF", "#C900FF", "#C700FF", "#C500FF", "#C200FF", "#C000FF", "#BD00FF",
    "#BB00FF", "#B900FF", "#B600FF", "#B400FF", "#B100FF", "#AF00FF", "#AD00FF",
    "#AA00FF", "#A800FF", "#A500FF", "#A300FF", "#A100FF", "#9E00FF", "#9C00FF",
    "#9900FF", "#9700FF", "#9400FF", "#9200FF", "#9000FF", "#8D00FF", "#8B00FF",
    "#8800FF", "#8600FF", "#8400FF", "#8100FF", "#7F00FF", "#7C00FF", "#7A00FF",
    "#7800FF", "#7500FF", "#7300FF", "#7000FF", "#6E00FF", "#6C00FF", "#6900FF",
    "#6700FF", "#6400FF", "#6200FF", "#5F00FF", "#5D00FF", "#5B00FF", "#5800FF",
    "#5600FF", "#5300FF", "#5100FF", "#4F00FF", "#4C00FF", "#4A00FF", "#4700FF",
    "#4500FF", "#4300FF", "#4000FF", "#3E00FF", "#3B00FF", "#3900FF", "#3700FF",
    "#3602FF", "#3505FF", "#3508FF", "#340BFF", "#330EFF", "#3310FF", "#3213FF",
    "#3116FF", "#3119FF", "#301CFF", "#2F1FFF", "#2F21FF", "#2E24FF", "#2D27FF",
    "#2D2AFF", "#2C2DFF", "#2B2FFF", "#2B32FF", "#2A35FF", "#2938FF", "#293BFF",
    "#283EFF", "#2740FF", "#2743FF", "#2646FF", "#2549FF", "#254CFF", "#244EFF",
    "#2351FF", "#2354FF", "#2257FF", "#215AFF", "#215DFF", "#205FFF", "#1F62FF",
    "#1F65FF", "#1E68FF", "#1D6BFF", "#1D6DFF", "#1C70FF", "#1B73FF", "#1B76FF",
    "#1A79FF", "#197CFF", "#197EFF", "#1881FF", "#1784FF", "#1787FF", "#168AFF",
    "#158CFF", "#158FFF", "#1492FF", "#1395FF", "#1398FF", "#129BFF", "#119DFF",
    "#11A0FF", "#10A3FF", "#0FA6FF", "#0FA9FF", "#0EABFF", "#0DAEFF", "#0DB1FF",
    "#0CB4FF", "#0BB7FF", "#0BBAFF", "#0ABCFF", "#09BFFF", "#09C2FF", "#08C5FF",
    "#07C8FF", "#07CAFF", "#06CDFF", "#05D0FF", "#05D3FF", "#04D6FF", "#03D9FF",
    "#03DBFF", "#02DEFF", "#01E1FF", "#01E4FF", "#00E7FF", "#00EAFF", "#00EAFB",
    "#00EAF8", "#00EAF5", "#00EBF2", "#01EBEF", "#01EBEC", "#01EBE9", "#01ECE6",
    "#01ECE3", "#02ECE0", "#02ECDD", "#02EDDA", "#02EDD7", "#02EDD3", "#03EDD0",
    "#03EECD", "#03EECA", "#03EEC7", "#03EEC4", "#04EFC1", "#04EFBE", "#04EFBB",
    "#04EFB8", "#04F0B5", "#05F0B2", "#05F0AF", "#05F0AC", "#05F1A8", "#05F1A5",
    "#06F1A2", "#06F19F", "#06F29C", "#06F299", "#06F296", "#07F293", "#07F390",
    "#07F38D", "#07F38A", "#07F387", "#08F484", "#08F481", "#08F47D", "#08F47A",
    "#09F577", "#09F574", "#09F571", "#09F56E", "#09F66B", "#0AF668", "#0AF665",
    "#0AF662", "#0AF75F", "#0AF75C", "#0BF759", "#0BF756", "#0BF852", "#0BF84F",
    "#0BF84C", "#0CF849", "#0CF946", "#0CF943", "#0CF940", "#0CF93D", "#0DFA3A",
    "#0DFA37", "#0DFA34", "#0DFA31", "#0DFB2E", "#0EFB2B", "#0EFB27", "#0EFB24",
    "#0EFC21", "#0EFC1E", "#0FFC1B", "#0FFC18", "#0FFD15", "#0FFD12", "#0FFD0F",
    "#10FD0C", "#10FE09", "#10FE06", "#10FE03", "#11FF00", "#13FF00", "#16FF00",
    "#19FF00", "#1BFF00", "#1EFF00", "#21FF00", "#23FF00", "#26FF00", "#29FF00",
    "#2CFF00", "#2EFF00", "#31FF00", "#34FF00", "#36FF00", "#39FF00", "#3CFF00",
    "#3FFF00", "#41FF00", "#44FF00", "#47FF00", "#49FF00", "#4CFF00", "#4FFF00",
    "#52FF00", "#54FF00", "#57FF00", "#5AFF00", "#5CFF00", "#5FFF00", "#62FF00",
    "#65FF00", "#67FF00", "#6AFF00", "#6DFF00", "#6FFF00", "#72FF00", "#75FF00",
    "#78FF00", "#7AFF00", "#7DFF00", "#80FF00", "#82FF00", "#85FF00", "#88FF00",
    "#8AFF00", "#8DFF00", "#90FF00", "#93FF00", "#95FF00", "#98FF00", "#9BFF00",
    "#9DFF00", "#A0FF00", "#A3FF00", "#A6FF00", "#A8FF00", "#ABFF00", "#AEFF00",
    "#B0FF00", "#B3FF00", "#B6FF00", "#B9FF00", "#BBFF00", "#BEFF00", "#C1FF00",
    "#C3FF00", "#C6FF00", "#C9FF00", "#CCFF00", "#CEFF00", "#D1FF00", "#D4FF00",
    "#D6FF00", "#D9FF00", "#DCFF00", "#DFFF00", "#E1FF00", "#E4FF00", "#E7FF00",
    "#E9FF00", "#ECFF00", "#EFFF00", "#F2FF00", "#F2FB00", "#F2F800", "#F2F500",
    "#F2F200", "#F2EF00", "#F2EC00", "#F3E900", "#F3E600", "#F3E300", "#F3E000",
    "#F3DD00", "#F3DA00", "#F4D700", "#F4D300", "#F4D000", "#F4CD00", "#F4CA00",
    "#F4C700", "#F4C400", "#F5C100", "#F5BE00", "#F5BB00", "#F5B800", "#F5B500",
    "#F5B200", "#F6AF00", "#F6AC00", "#F6A800", "#F6A500", "#F6A200", "#F69F00",
    "#F79C00", "#F79900", "#F79600", "#F79300", "#F79000", "#F78D00", "#F78A00",
    "#F88700", "#F88400", "#F88100", "#F87D00", "#F87A00", "#F87700", "#F97400",
    "#F97100", "#F96E00", "#F96B00", "#F96800", "#F96500", "#F96200", "#FA5F00",
    "#FA5C00", "#FA5900", "#FA5600", "#FA5200", "#FA4F00", "#FB4C00", "#FB4900",
    "#FB4600", "#FB4300", "#FB4000", "#FB3D00", "#FC3A00", "#FC3700", "#FC3400",
    "#FC3100", "#FC2E00", "#FC2B00", "#FC2700", "#FD2400", "#FD2100", "#FD1E00",
    "#FD1B00", "#FD1800", "#FD1500", "#FE1200", "#FE0F00", "#FE0C00", "#FE0900",
    "#FE0600", "#FE0300", "#FF0000"
];