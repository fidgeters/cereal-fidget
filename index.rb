require 'rubygems'
require 'serialport'
require 'thread'
require 'json'
require 'httparty'

$queue = SizedQueue.new(1024)

def bytes2number(bytes, offset)
  bytes[offset] | (bytes[offset+1] << 8) | (bytes[offset+2] << 16) | (bytes[offset+3] << 24)
end

def sender
  loop do
    data = $queue.pop.bytes

    case data[0]
    when 1
      pressed_at = bytes2number(data, 1)
      duration = bytes2number(data, 5)
      send_event(type: 'button', pressed_at: pressed_at, duration: duration)
    when 6
      pressed_at = bytes2number(data, 1)
      value = data[5]
      send_event type: 'switch', pressed_at: pressed_at, value: value
    when 9
      pressed_at = bytes2number(data, 1)
      value = data[5]
      send_event type: 'meter', pressed_at: pressed_at, value: value
    end
  end
rescue => e
  STDERR.puts "#{e.class}: #{e.message}"
  STDERR.puts e.backtrace
  retry
end

def send_event(data)
  STDERR.puts "sending #{data.inspect}"
  res = HTTParty.post('http://fidgit.fun/api/events', :body => { events: [data], device_id: 'the-one' }.to_json,
    :headers => { 'Content-Type' => 'application/json' } )

  if res.code < 400
    puts "ok"
  else
    sleep 1
    send_event data
  end

end

sp = SerialPort.new(ARGV[0])
sp.baud = 9600

Thread.new { sender }

until sp.eof?
  buf = sp.read(9)

  $queue << buf
end
