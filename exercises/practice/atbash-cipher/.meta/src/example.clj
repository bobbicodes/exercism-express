(ns atbash-cipher
  (:require [clojure.string :as str]))

(def  letters
  (map char
       (range (int \a) (inc (int \z)))))

(def  to-cipher
  (apply hash-map
         (interleave letters (reverse letters))))

(defn- sanitize
  [plaintext]
  (str/replace (str/lower-case plaintext) #"\W" ""))

(defn- cipher
  [plain-char]
  (or (to-cipher plain-char) plain-char))

(defn- to-chunks
  [character-list]
  (map #(apply str %) (partition 5 5 "" character-list)))

(defn encode
  [plaintext]
  (->> plaintext
       sanitize
       (map cipher)
       to-chunks
       (str/join " ")))
