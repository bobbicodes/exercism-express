(ns gigasecond)

(defn leap-year? [year]
  (cond
    (zero? (mod year 400)) true
    (zero? (mod year 100)) false
    :else (zero? (mod year 4))))

(defn days-in-month [year month]
  (cond
    (= month 2) (if (leap-year? year) 29 28)
    (some #(= month %) [4 6 9 11]) 30
    :else 31))

(defn days-to-next-month [year month day]
  (+ (days-in-month year month) (- day) 1))

(defn from [y m d]
  (let [total-seconds 1000000000
        seconds-per-day 86400
        total-days (int (/ total-seconds seconds-per-day))]
    (loop [year y
           month m
           day d
           remaining total-days]
      (let [jump (days-to-next-month year month day)]
        (if-not (>= remaining jump)
          [year month (+ day remaining)]
          (recur
           (if (zero? (mod month 12)) (inc year) year)
           (inc (mod month 12))
           1 (- remaining jump)))))))