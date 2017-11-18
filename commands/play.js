const settings = require("../config/settings.json");
const musicPlayer = require("../util/musicPlayer");
const musicDownloader = require("../util/musicDownloader");
const YouTube = require("youtube-node");

const youTube = new YouTube();
youTube.setKey(settings.youtubeApiKey);

function getYoutubeID(url) {
  let regExp = /^.*(youtu\.be\/|v\/|u\/\w\/|embed\/|watch\?v=|\&v=)([^#\&\?]*).*/;
  let match = url.match(regExp);
  if (match && match[2].length == 11) {
    return match[2];
  } else {
    return false;
  }
}

function getPlaylistID(url) {
  let regExp = /^https?:\/\/.*(list=)([^#\&\?\/]*).*/;
  let match = url.match(regExp);
  if (match && match[2].length == 34) {
    return match[2];
  } else {
    return false;
  }
}

function getVote(name) {
  switch (name) {
    case "1⃣":
      return 1;
      break;
    case "2⃣":
      return 2;
      break;
    case "3⃣":
      return 3;
      break;
    default:
      return;
  }
}

const ytOptions = {
  maxResults: 3,
  part: "snippet",
  type: "video",
  key: settings.youtubeApiKey
};

exports.run = (client, message, args) => {
  if (!args[0]) return message.channel.send(`[Music] Please provide a direct link or search for a video on youtube.`);

  if (!message.member.voiceChannel) return message.channel.send("[Music] You have to be in a voice channel to use this command.");

  let videoID = getYoutubeID(args[0]);
  let url, title;
  if (!musicPlayer.servers[message.guild.id]) musicPlayer.servers[message.guild.id] = {
    queue: []
  };
  let server = musicPlayer.servers[message.guild.id];
  if (videoID) {
    youTube.getById(videoID, function(error, result) {
      if (error) return console.log(error);
      let url = `https://www.youtube.com/watch?v=${result.items[0].id}`;
      let title = result.items[0].snippet.title;
      message.channel.send(`[Music] Downloading \`${url}\`...`).then(msg => {
        musicDownloader.downloadSong(url, true, function(callback) {
          if (callback === false) return msg.edit(`[Music] Error while downloading file.`);
          server.queue.push({
            url: url,
            title: title,
            file: callback,
            channel: message.channel,
            requester: message.author.id
          });
          msg.edit(`[Music] \`${title}\` \`(${url})\` has been added to the queue.`);
          if (!message.guild.voiceConnection) message.member.voiceChannel.join()
            .then(connection => { musicPlayer.play(connection, message); });
        });
      });
    });
  } else if (args[0].startsWith("http://") || args[0].startsWith("https://")) {
    let url = args[0];
    message.channel.send(`[Music] Downloading \`${url}\`...`).then(msg => {
      musicDownloader.downloadSong(url, false, function(callback) {
        if (callback === false) return msg.edit(`[Music] Error while downloading file.`);
        server.queue.push({
          url: url,
          title: url,
          file: callback,
          channel: message.channel,
          requester: message.author.id
        });
        msg.edit(`[Music] \`${url}\` has been added to the queue.`);
        if (!message.guild.voiceConnection) message.member.voiceChannel.join()
          .then(connection => { musicPlayer.play(connection, message); });
      });
    });
  } else {
      youTube.search(args.join(" "), 3, function(error, results) {
      if (error) return console.log(error);
      if (results.items.length === 1) {
        let url = `https://www.youtube.com/watch?v=${results.items[0].id.videoId}`;
        message.channel.send(`[Music] Downloading \`${url}\`...`).then(msg => {
          musicDownloader.downloadSong(url, true, function(callback) {
            if (callback === false) return msg.edit("[Music] Error while downloading file.");
            server.queue.push({
              url: url,
              title: results.items[0].snippet.title,
              file: callback,
              channel: message.channel,
              requester: message.author.id
            });
            msg.edit(`[Music] Found only one video. Added \`${results.items[0].snippet.title}\` to the queue.`);
            if (!message.guild.voiceConnection) message.member.voiceChannel.join()
              .then(connection => {
                musicPlayer.play(connection, message);
              });
          });
        });
        return;
      } else if(results.items.length === 0) {
        return message.channel.send(`[Music] No videos found.`);
      }
      let msgText = "[Music] Select from one of the following results by clicking on a reaction:\n";
      for (var i = 0; i < results.items.length; i++) {
        msgText += `**${i + 1}.** ${results.items[i].snippet.title} \`https://www.youtube.com/watch?v=${results.items[i].id.videoId}\`\n`;
      }
      message.channel.send(msgText)
        .then(async (msg) => {
          const collector = msg.createReactionCollector(
            (reaction, user) => user.id === message.author.id,
            {time: 30000}
          );
          collector.on("collect", r => {
            if (r.emoji.name === "❌") {
              msg.clearReactions();
              msg.edit(`[Music] Search cancelled.`);
            }
            let vote = getVote(r.emoji.name);
            if (vote) {
              collector.stop();
              let video = results.items[vote - 1];
              let url = `https://www.youtube.com/watch?v=${video.id.videoId}`;
              msg.clearReactions();
              msg.edit(`[Music] Downloading \`${url}\`...`);
              musicDownloader.downloadSong(url, true, function(callback) {
                if (callback === false) return msg.edit("[Music] Error while downloading file.");
                server.queue.push({
                  url: url,
                  title: video.snippet.title,
                  file: callback,
                  channel: message.channel,
                  requester: message.author.id
                });
                msg.edit(`[Music] \`${video.snippet.title}\` \`(${url})\` has been added to the queue.`);
                if (!message.guild.voiceConnection) message.member.voiceChannel.join()
                  .then(connection => {
                    musicPlayer.play(connection, message);
                  });
              });
            }
          });
          collector.on("end", r => {
            msg.clearReactions();
            msg.edit(`[Music] Search cancelled.`);
          });
          switch (results.items.length) {
            case 3:
              for (emoji of ["1⃣", "2⃣", "3⃣", "❌"]) {
                if (collector.ended) break;
                await msg.react(emoji);
              }
              break;
            case 2:
              for (emoji of ["1⃣", "2⃣", "❌"]) {
                if (collector.ended) break;
                await msg.react(emoji);
              }
              break;
            default:
          }
        });
    });
  }
};

exports.conf = {
  enabled: true,
  guildOnly: false,
  aliases: [],
  permLevel: 0
};

exports.help = {
  name: "play",
  description: "Plays a song from a youtube link",
  usage: "play <link / youtube search>"
};
