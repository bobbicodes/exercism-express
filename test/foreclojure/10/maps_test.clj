(deftest maps-test
  (is (= n ((hash-map :a 10, :b 20, :c 30) :b)))
  (is (= n (:b {:a 10, :b 20, :c 30}))))